const mongoose = require('mongoose');
const SubscriptionHealthChecker = require('../services/subscriptionHealthChecker');

// MongoDB connection
require('dotenv').config();

async function runSubscriptionHealthCheck() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aistory');
        console.log('✅ Connected to MongoDB\n');
        
        const healthChecker = new SubscriptionHealthChecker();
        
        // Run health check
        const report = await healthChecker.runHealthCheck();
        
        // Print report
        healthChecker.printReport(report);
        
        // Ask if user wants to auto-fix issues
        if (report.summary.totalIssues > 0) {
            console.log('\n🤔 Would you like to apply auto-fixes? (This will modify the database)');
            console.log('Note: Only safe, reversible fixes will be applied automatically');
            
            // For now, we'll auto-apply fixes if there are any fixable issues
            const fixableTypes = ['EXPIRED_SUBSCRIPTION', 'SHOULD_DOWNGRADE', 'PAYMENT_SUBSCRIPTION_MISMATCH'];
            const fixableIssues = report.issues.filter(issue => fixableTypes.includes(issue.type));
            
            if (fixableIssues.length > 0) {
                console.log(`\n🔧 Applying auto-fixes for ${fixableIssues.length} fixable issues...`);
                const fixes = await healthChecker.autoFix();
                
                console.log('\n✅ Auto-fixes completed!');
                console.log('🔄 Running health check again to verify fixes...\n');
                
                // Run health check again to verify fixes
                const finalReport = await healthChecker.runHealthCheck();
                healthChecker.printReport(finalReport);
            } else {
                console.log('\n⚠️ No auto-fixable issues found. Manual intervention required.');
            }
        } else {
            console.log('\n🎉 No issues found! Subscription system is healthy.');
        }
        
        // Save report to file
        const fs = require('fs');
        const reportFileName = `subscription-health-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        fs.writeFileSync(reportFileName, JSON.stringify(report, null, 2));
        console.log(`\n💾 Report saved to: ${reportFileName}`);
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Health check failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runSubscriptionHealthCheck();
}

module.exports = runSubscriptionHealthCheck;
