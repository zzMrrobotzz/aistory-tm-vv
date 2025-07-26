const User = require('../models/User');
const Payment = require('../models/Payment');
const CreditPackage = require('../models/CreditPackage');

class SubscriptionHealthChecker {
    constructor() {
        this.issues = [];
        this.fixes = [];
    }
    
    // Main health check function
    async runHealthCheck() {
        console.log('🏥 STARTING SUBSCRIPTION HEALTH CHECK...\n');
        
        this.issues = [];
        this.fixes = [];
        
        await this.checkUsernameConflicts();
        await this.checkSubscriptionMismatches();
        await this.checkExpiredSubscriptions();
        await this.checkPaymentSubscriptionSync();
        await this.checkOrphanedPayments();
        
        return this.generateReport();
    }
    
    // Check for username conflicts (like yeu00nguoi vs yeu00nguoi1)
    async checkUsernameConflicts() {
        console.log('1️⃣ Checking username conflicts...');
        
        const users = await User.find({}, 'username email subscriptionType subscriptionExpiresAt');
        const usernameGroups = {};
        
        // Group similar usernames
        users.forEach(user => {
            const base = user.username.replace(/\d+$/, ''); // Remove trailing numbers
            if (!usernameGroups[base]) {
                usernameGroups[base] = [];
            }
            usernameGroups[base].push(user);
        });
        
        // Find groups with multiple users
        for (const [base, group] of Object.entries(usernameGroups)) {
            if (group.length > 1) {
                const paidUsers = group.filter(u => u.subscriptionType && u.subscriptionType !== 'free');
                
                if (paidUsers.length > 0) {
                    this.issues.push({
                        type: 'USERNAME_CONFLICT',
                        severity: 'HIGH',
                        description: `Multiple users with similar usernames: ${group.map(u => u.username).join(', ')}`,
                        users: group,
                        paidUsers: paidUsers.length
                    });
                }
            }
        }
        
        console.log(`   Found ${this.issues.filter(i => i.type === 'USERNAME_CONFLICT').length} username conflicts`);
    }
    
    // Check for subscription vs database mismatches
    async checkSubscriptionMismatches() {
        console.log('2️⃣ Checking subscription mismatches...');
        
        const users = await User.find({
            subscriptionType: { $ne: 'free' }
        });
        
        for (const user of users) {
            const now = new Date();
            
            // Check if subscription is expired but still marked as premium
            if (user.subscriptionExpiresAt && user.subscriptionExpiresAt < now) {
                if (user.subscriptionType !== 'free') {
                    this.issues.push({
                        type: 'EXPIRED_SUBSCRIPTION',
                        severity: 'MEDIUM',
                        description: `User ${user.username} has expired subscription but still marked as ${user.subscriptionType}`,
                        user: user,
                        expiredDate: user.subscriptionExpiresAt
                    });
                }
            }
            
            // Check for missing expiry date on time-limited subscriptions
            if (!user.subscriptionExpiresAt && user.subscriptionType && 
                user.subscriptionType !== 'free' && user.subscriptionType !== 'lifetime') {
                this.issues.push({
                    type: 'MISSING_EXPIRY',
                    severity: 'HIGH',
                    description: `User ${user.username} has ${user.subscriptionType} but no expiry date`,
                    user: user
                });
            }
        }
        
        console.log(`   Found ${this.issues.filter(i => i.type === 'EXPIRED_SUBSCRIPTION').length} expired subscriptions`);
        console.log(`   Found ${this.issues.filter(i => i.type === 'MISSING_EXPIRY').length} missing expiry dates`);
    }
    
    // Check for payments without corresponding subscription updates
    async checkPaymentSubscriptionSync() {
        console.log('3️⃣ Checking payment-subscription sync...');
        
        const completedPayments = await Payment.find({
            status: 'completed',
            userId: { $exists: true },
            planId: { $exists: true }
        }).populate('userId');
        
        for (const payment of completedPayments) {
            if (!payment.userId) continue;
            
            const user = payment.userId;
            const paymentDate = payment.completedAt || payment.createdAt;
            
            // Check if user's subscription type matches payment
            if (user.subscriptionType !== payment.planId) {
                this.issues.push({
                    type: 'PAYMENT_SUBSCRIPTION_MISMATCH',
                    severity: 'HIGH',
                    description: `Payment for ${payment.planId} but user has ${user.subscriptionType}`,
                    user: user,
                    payment: payment,
                    paymentDate: paymentDate
                });
            }
            
            // Check if subscription expiry makes sense with payment date
            const plan = await CreditPackage.findOne({ planId: payment.planId });
            if (plan && user.subscriptionExpiresAt) {
                const expectedExpiry = new Date(paymentDate);
                if (plan.durationType === 'days') {
                    expectedExpiry.setDate(expectedExpiry.getDate() + plan.durationValue);
                } else if (plan.durationType === 'months') {
                    expectedExpiry.setMonth(expectedExpiry.getMonth() + plan.durationValue);
                }
                
                const expiryDiff = Math.abs(expectedExpiry.getTime() - user.subscriptionExpiresAt.getTime());
                const daysDiff = expiryDiff / (1000 * 60 * 60 * 24);
                
                if (daysDiff > 2) { // Allow 2 days tolerance
                    this.issues.push({
                        type: 'EXPIRY_DATE_MISMATCH',
                        severity: 'MEDIUM',
                        description: `User ${user.username} expiry date doesn't match payment plan`,
                        user: user,
                        payment: payment,
                        expectedExpiry: expectedExpiry,
                        actualExpiry: user.subscriptionExpiresAt,
                        daysDifference: daysDiff
                    });
                }
            }
        }
        
        console.log(`   Found ${this.issues.filter(i => i.type === 'PAYMENT_SUBSCRIPTION_MISMATCH').length} payment mismatches`);
        console.log(`   Found ${this.issues.filter(i => i.type === 'EXPIRY_DATE_MISMATCH').length} expiry date mismatches`);
    }
    
    // Check for expired subscriptions that should be downgraded
    async checkExpiredSubscriptions() {
        console.log('4️⃣ Checking expired subscriptions...');
        
        const now = new Date();
        const expiredUsers = await User.find({
            subscriptionType: { $ne: 'free' },
            subscriptionExpiresAt: { $lt: now }
        });
        
        for (const user of expiredUsers) {
            if (user.subscriptionType === 'lifetime') continue; // Skip lifetime
            
            this.issues.push({
                type: 'SHOULD_DOWNGRADE',
                severity: 'MEDIUM',
                description: `User ${user.username} subscription expired but not downgraded to free`,
                user: user,
                expiredDate: user.subscriptionExpiresAt
            });
        }
        
        console.log(`   Found ${expiredUsers.length} users with expired subscriptions`);
    }
    
    // Check for orphaned payments
    async checkOrphanedPayments() {
        console.log('5️⃣ Checking orphaned payments...');
        
        const orphanedPayments = await Payment.find({
            status: 'completed',
            userId: null
        });
        
        for (const payment of orphanedPayments) {
            this.issues.push({
                type: 'ORPHANED_PAYMENT',
                severity: 'HIGH',
                description: `Completed payment ${payment._id} has no associated user`,
                payment: payment
            });
        }
        
        console.log(`   Found ${orphanedPayments.length} orphaned payments`);
    }
    
    // Auto-fix issues where possible
    async autoFix() {
        console.log('\n🔧 ATTEMPTING AUTO-FIXES...\n');
        
        for (const issue of this.issues) {
            try {
                switch (issue.type) {
                    case 'EXPIRED_SUBSCRIPTION':
                        await this.fixExpiredSubscription(issue);
                        break;
                    case 'SHOULD_DOWNGRADE':
                        await this.fixShouldDowngrade(issue);
                        break;
                    case 'PAYMENT_SUBSCRIPTION_MISMATCH':
                        await this.fixPaymentMismatch(issue);
                        break;
                }
            } catch (error) {
                console.error(`Failed to fix issue ${issue.type}:`, error.message);
            }
        }
        
        console.log(`Applied ${this.fixes.length} auto-fixes`);
        return this.fixes;
    }
    
    async fixExpiredSubscription(issue) {
        const user = issue.user;
        user.subscriptionType = 'free';
        user.subscriptionExpiresAt = null;
        await user.save();
        
        this.fixes.push({
            type: 'DOWNGRADED_EXPIRED',
            description: `Downgraded ${user.username} from expired subscription to free`,
            userId: user._id
        });
        
        console.log(`✅ Fixed: Downgraded ${user.username} to free`);
    }
    
    async fixShouldDowngrade(issue) {
        const user = issue.user;
        user.subscriptionType = 'free';
        user.subscriptionExpiresAt = null;
        await user.save();
        
        this.fixes.push({
            type: 'DOWNGRADED_EXPIRED',
            description: `Downgraded ${user.username} from expired subscription to free`,
            userId: user._id
        });
        
        console.log(`✅ Fixed: Downgraded ${user.username} to free`);
    }
    
    async fixPaymentMismatch(issue) {
        const user = issue.user;
        const payment = issue.payment;
        
        // Update user subscription to match payment
        user.subscriptionType = payment.planId;
        
        // Calculate proper expiry date
        const plan = await CreditPackage.findOne({ planId: payment.planId });
        if (plan) {
            const paymentDate = payment.completedAt || payment.createdAt;
            const expiryDate = new Date(paymentDate);
            
            if (plan.durationType === 'days') {
                expiryDate.setDate(expiryDate.getDate() + plan.durationValue);
            } else if (plan.durationType === 'months') {
                if (plan.durationValue >= 999) {
                    expiryDate.setFullYear(2099); // Lifetime
                } else {
                    expiryDate.setMonth(expiryDate.getMonth() + plan.durationValue);
                }
            }
            
            user.subscriptionExpiresAt = expiryDate;
        }
        
        await user.save();
        
        this.fixes.push({
            type: 'SYNCED_PAYMENT_SUBSCRIPTION',
            description: `Synced ${user.username} subscription with payment ${payment._id}`,
            userId: user._id,
            paymentId: payment._id
        });
        
        console.log(`✅ Fixed: Synced ${user.username} subscription with payment`);
    }
    
    // Generate comprehensive report
    generateReport() {
        const report = {
            timestamp: new Date(),
            summary: {
                totalIssues: this.issues.length,
                highSeverity: this.issues.filter(i => i.severity === 'HIGH').length,
                mediumSeverity: this.issues.filter(i => i.severity === 'MEDIUM').length,
                lowSeverity: this.issues.filter(i => i.severity === 'LOW').length
            },
            issuesByType: {},
            issues: this.issues,
            fixes: this.fixes
        };
        
        // Group issues by type
        this.issues.forEach(issue => {
            if (!report.issuesByType[issue.type]) {
                report.issuesByType[issue.type] = 0;
            }
            report.issuesByType[issue.type]++;
        });
        
        return report;
    }
    
    // Print human-readable report
    printReport(report) {
        console.log('\n📊 SUBSCRIPTION HEALTH CHECK REPORT');
        console.log('=====================================\n');
        
        console.log('📈 SUMMARY:');
        console.log(`   Total Issues: ${report.summary.totalIssues}`);
        console.log(`   High Severity: ${report.summary.highSeverity}`);
        console.log(`   Medium Severity: ${report.summary.mediumSeverity}`);
        console.log(`   Low Severity: ${report.summary.lowSeverity}`);
        
        console.log('\n📋 ISSUES BY TYPE:');
        Object.entries(report.issuesByType).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });
        
        if (report.issues.length > 0) {
            console.log('\n🚨 CRITICAL ISSUES REQUIRING ATTENTION:');
            report.issues.filter(i => i.severity === 'HIGH').forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.description}`);
            });
        }
        
        if (report.fixes.length > 0) {
            console.log('\n✅ AUTO-FIXES APPLIED:');
            report.fixes.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix.description}`);
            });
        }
        
        console.log('\n🎯 RECOMMENDATIONS:');
        if (report.summary.highSeverity > 0) {
            console.log('   - Immediate admin attention required for high severity issues');
        }
        if (report.issuesByType.USERNAME_CONFLICT > 0) {
            console.log('   - Contact users with username conflicts to clarify correct login credentials');
        }
        if (report.issuesByType.ORPHANED_PAYMENT > 0) {
            console.log('   - Review orphaned payments and manually assign to correct users');
        }
        
        console.log('\n=====================================');
    }
}

module.exports = SubscriptionHealthChecker;
