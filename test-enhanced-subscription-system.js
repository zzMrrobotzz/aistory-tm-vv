const mongoose = require('./apps/backend/node_modules/mongoose');
const SubscriptionHealthChecker = require('./apps/backend/services/subscriptionHealthChecker');
const EnhancedPaymentService = require('./apps/backend/services/enhancedPaymentService');
const { findUserByUsernameVariations } = require('./apps/backend/utils/usernameUtils');

// Load environment variables
require('dotenv').config();

async function testEnhancedSubscriptionSystem() {
    try {
        console.log('🧪 TESTING ENHANCED SUBSCRIPTION SYSTEM...\n');
        
        // Connect to MongoDB
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aistory');
        console.log('✅ Connected to MongoDB\n');
        
        // Test 1: Username Resolution
        console.log('1️⃣ Testing Username Resolution...');
        await testUsernameResolution();
        
        // Test 2: Subscription Health Check
        console.log('\n2️⃣ Testing Subscription Health Check...');
        await testHealthCheck();
        
        // Test 3: Enhanced Payment Processing (simulation)
        console.log('\n3️⃣ Testing Enhanced Payment Processing...');
        await testEnhancedPaymentProcessing();
        
        // Test 4: Edge Cases
        console.log('\n4️⃣ Testing Edge Cases...');
        await testEdgeCases();
        
        console.log('\n🎉 All tests completed successfully!');
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

async function testUsernameResolution() {
    const User = require('./apps/backend/models/User');
    
    // Test finding user with variations
    const testUsernames = ['yeu00nguoi', 'YEU00NGUOI', 'yeu00nguoi1'];
    
    for (const username of testUsernames) {
        try {
            const result = await findUserByUsernameVariations(User, username);
            if (result) {
                console.log(`✅ Found user for "${username}": ${result.matchedUsername} (${result.user.email})`);
            } else {
                console.log(`❌ No user found for "${username}"`);
            }
        } catch (error) {
            console.log(`❌ Error testing "${username}": ${error.message}`);
        }
    }
}

async function testHealthCheck() {
    const healthChecker = new SubscriptionHealthChecker();
    const report = await healthChecker.runHealthCheck();
    
    console.log(`📊 Health Check Results:`);
    console.log(`   Total Issues: ${report.summary.totalIssues}`);
    console.log(`   High Severity: ${report.summary.highSeverity}`);
    console.log(`   Medium Severity: ${report.summary.mediumSeverity}`);
    
    // Show sample issues
    if (report.issues.length > 0) {
        console.log('\n🔍 Sample Issues:');
        report.issues.slice(0, 3).forEach((issue, index) => {
            console.log(`   ${index + 1}. ${issue.type}: ${issue.description}`);
        });
    }
    
    return report;
}

async function testEnhancedPaymentProcessing() {
    const PaymentService = require('./apps/backend/services/paymentService');
    const paymentService = new PaymentService();
    const enhancedService = new EnhancedPaymentService(paymentService);
    
    // Test user resolution with different identifiers
    const testIdentifiers = [
        'yeu00nguoi1',
        'yeu00nguoi1@gmail.com',
        'nonexistent@example.com'
    ];
    
    for (const identifier of testIdentifiers) {
        try {
            const user = await enhancedService.findUserReliably(identifier);
            if (user) {
                console.log(`✅ Enhanced resolution for "${identifier}": ${user.username} (${user.email})`);
                
                // Test subscription eligibility
                const mockPlan = { planId: 'monthly_premium', durationValue: 1, durationType: 'months' };
                await enhancedService.validateSubscriptionEligibility(user, mockPlan);
                console.log(`   ✅ Subscription eligibility validated`);
                
            } else {
                console.log(`❌ Enhanced resolution failed for "${identifier}"`);
            }
        } catch (error) {
            console.log(`❌ Error testing "${identifier}": ${error.message}`);
        }
    }
}

async function testEdgeCases() {
    console.log('🧪 Testing edge cases...');
    
    // Test 1: Empty/null inputs
    const testCases = [
        { input: '', description: 'Empty string' },
        { input: null, description: 'Null value' },
        { input: undefined, description: 'Undefined value' },
        { input: '  yeu00nguoi  ', description: 'Username with spaces' },
        { input: 'YEU00NGUOI', description: 'Uppercase username' },
        { input: 'invalid@email', description: 'Invalid email format' }
    ];
    
    const { normalizeUsername } = require('./apps/backend/utils/usernameUtils');
    
    testCases.forEach(testCase => {
        try {
            const normalized = normalizeUsername(testCase.input);
            console.log(`   ${testCase.description}: "${testCase.input}" → "${normalized}"`);
        } catch (error) {
            console.log(`   ${testCase.description}: Error - ${error.message}`);
        }
    });
}

// Integration test for the current user issue
async function testCurrentUserIssue() {
    console.log('\n🎯 TESTING CURRENT USER ISSUE RESOLUTION...\n');
    
    const User = require('./apps/backend/models/User');
    
    // Test exact case: yeu00nguoi vs yeu00nguoi1
    const inputUsername = 'yeu00nguoi';
    const result = await findUserByUsernameVariations(User, inputUsername);
    
    if (result) {
        console.log('✅ SOLUTION VERIFIED:');
        console.log(`   Input: ${inputUsername}`);
        console.log(`   Found: ${result.matchedUsername}`);
        console.log(`   Email: ${result.user.email}`);
        console.log(`   Subscription: ${result.user.subscriptionType}`);
        
        if (result.user.subscriptionExpiresAt) {
            const now = new Date();
            const expiry = new Date(result.user.subscriptionExpiresAt);
            const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            console.log(`   Days Left: ${daysLeft}`);
            console.log(`   Status: ${daysLeft > 0 ? '✅ Active' : '❌ Expired'}`);
        }
        
        console.log('\n💡 USER SHOULD LOGIN WITH:');
        console.log(`   Username: ${result.matchedUsername}`);
        console.log(`   Password: [their original password]`);
        
    } else {
        console.log('❌ User still not found - may need manual intervention');
    }
}

// Run specific test
if (process.argv[2] === 'current-user') {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aistory')
        .then(() => testCurrentUserIssue())
        .then(() => mongoose.disconnect())
        .catch(console.error);
} else {
    testEnhancedSubscriptionSystem();
}

module.exports = {
    testEnhancedSubscriptionSystem,
    testCurrentUserIssue
};
