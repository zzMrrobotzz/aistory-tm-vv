const mongoose = require('mongoose');
const CreditPackage = require('../models/CreditPackage');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nguyenquangngocubt:dsdsmkghjfmstrongkimuyqmsdad@server.z2lml.mongodb.net/aiwriterstory';

async function addDailyTrialPackage() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Check if daily trial package already exists
        const existingPackage = await CreditPackage.findOne({ planId: 'trial_3days' });
        if (existingPackage) {
            console.log('⚠️ Daily trial package already exists:', existingPackage.name);
            await mongoose.disconnect();
            return existingPackage;
        }
        
        // Create 3-day trial package
        const trialPackage = new CreditPackage({
            planId: 'trial_3days',
            name: 'Gói Dùng Thử 3 Ngày',
            description: 'Trải nghiệm đầy đủ tính năng trong 3 ngày',
            price: 49000, // 49k VND for 3-day trial
            durationType: 'days',
            durationValue: 3,
            durationMonths: null, // Not applicable for daily packages
            isPopular: false,
            isActive: true
        });
        
        await trialPackage.save();
        console.log('✅ Daily trial package created successfully!');
        console.log('📦 Package details:', {
            planId: trialPackage.planId,
            name: trialPackage.name,
            price: trialPackage.price,
            durationType: trialPackage.durationType,
            durationValue: trialPackage.durationValue
        });
        
        // Also create a 7-day trial package
        const weeklyTrial = new CreditPackage({
            planId: 'trial_7days',
            name: 'Gói Dùng Thử 1 Tuần',
            description: 'Trải nghiệm đầy đủ tính năng trong 7 ngày',
            price: 99000, // 99k VND for 7-day trial
            durationType: 'days',
            durationValue: 7,
            durationMonths: null,
            isPopular: true, // Mark as popular trial option
            isActive: true
        });
        
        await weeklyTrial.save();
        console.log('✅ Weekly trial package created successfully!');
        console.log('📦 Package details:', {
            planId: weeklyTrial.planId,
            name: weeklyTrial.name,
            price: weeklyTrial.price,
            durationType: weeklyTrial.durationType,
            durationValue: weeklyTrial.durationValue
        });
        
        // Update existing packages to use new duration system (backward compatibility)
        console.log('🔄 Updating existing packages for compatibility...');
        
        const monthlyPackage = await CreditPackage.findOne({ planId: 'monthly_premium' });
        if (monthlyPackage && !monthlyPackage.durationType) {
            monthlyPackage.durationType = 'months';
            monthlyPackage.durationValue = monthlyPackage.durationMonths || 1;
            await monthlyPackage.save();
            console.log('✅ Updated monthly package');
        }
        
        const lifetimePackage = await CreditPackage.findOne({ planId: 'lifetime_premium' });
        if (lifetimePackage && !lifetimePackage.durationType) {
            lifetimePackage.durationType = 'months';
            lifetimePackage.durationValue = lifetimePackage.durationMonths || 999;
            await lifetimePackage.save();
            console.log('✅ Updated lifetime package');
        }
        
        // Display all packages
        console.log('\n📋 All available packages:');
        const allPackages = await CreditPackage.find({ isActive: true }).sort({ price: 1 });
        allPackages.forEach(pkg => {
            const duration = pkg.durationType === 'days' 
                ? `${pkg.durationValue} ngày`
                : pkg.durationValue >= 999 
                    ? 'Vĩnh viễn'
                    : `${pkg.durationValue} tháng`;
            
            console.log(`- ${pkg.name}: ${pkg.price.toLocaleString()} VND (${duration})`);
        });
        
        await mongoose.disconnect();
        console.log('✅ Database connection closed');
        
        return { trialPackage, weeklyTrial };
        
    } catch (error) {
        console.error('❌ Error adding daily trial package:', error);
        await mongoose.disconnect();
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    addDailyTrialPackage()
        .then(() => {
            console.log('🎉 Daily trial packages added successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Failed to add daily trial packages:', error);
            process.exit(1);
        });
}

module.exports = { addDailyTrialPackage };