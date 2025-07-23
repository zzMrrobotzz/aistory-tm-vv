const axios = require('./apps/backend/node_modules/axios').default;

const API_URL = 'https://aistory-backend.onrender.com/api';

async function add5DayPackage() {
    try {
        console.log('🚀 Adding 5-day trial package...\n');
        
        // We'll create a direct database call since we don't have a generic add-package endpoint
        // For now, let's show the pattern and create via MongoDB update
        
        console.log('📦 Package specification for 5-day trial:');
        const package5Days = {
            planId: 'trial_5days',           // ✅ Pattern: trial_[number]days
            name: 'Gói Dùng Thử 5 Ngày',   // Vietnamese name
            description: 'Trải nghiệm đầy đủ tính năng trong 5 ngày',
            price: 69000,                    // 69k VND (between 3-day and 7-day)
            durationType: 'days',           // ✅ Must be 'days' for daily packages
            durationValue: 5,               // ✅ Number of days
            durationMonths: null,           // Not applicable for daily packages
            isPopular: false,               // Could be true if you want to highlight it
            isActive: true                  // Must be true to show in frontend
        };
        
        console.log('📋 Package details:');
        console.log(`- Plan ID: ${package5Days.planId}`);
        console.log(`- Name: ${package5Days.name}`);
        console.log(`- Price: ${package5Days.price.toLocaleString()} VND`);
        console.log(`- Duration: ${package5Days.durationValue} ${package5Days.durationType}`);
        console.log(`- Popular: ${package5Days.isPopular ? 'Yes' : 'No'}`);
        
        // Since we need to add this to database, I'll create a simple endpoint call
        // But first, let's verify current packages
        console.log('\n🔍 Current packages in database:');
        const packagesResponse = await axios.get(`${API_URL}/packages`);
        const currentPackages = packagesResponse.data.packages;
        
        console.log('📦 Existing packages:');
        currentPackages.forEach((pkg, index) => {
            const duration = pkg.durationType === 'days' 
                ? `${pkg.durationValue} ngày`
                : pkg.durationValue >= 999 
                    ? 'Vĩnh viễn'
                    : `${pkg.durationValue} tháng`;
            console.log(`${index + 1}. ${pkg.name} (${pkg.planId}) - ${pkg.price.toLocaleString()} VND - ${duration}`);
        });
        
        // Check if 5-day package already exists
        const existing5Day = currentPackages.find(p => p.planId === 'trial_5days');
        if (existing5Day) {
            console.log('\n⚠️ 5-day trial package already exists!');
            console.log('Package details:', {
                name: existing5Day.name,
                price: existing5Day.price,
                duration: `${existing5Day.durationValue} ${existing5Day.durationType}`
            });
            return existing5Day;
        }
        
        console.log('\n✅ 5-day package specification created!');
        console.log('📝 To add this package to database, you have 2 options:');
        
        console.log('\n🔧 Option 1: Via Backend API (Recommended)');
        console.log('Add this package definition to the /api/payment/add-daily-packages endpoint:');
        console.log('```javascript');
        console.log(JSON.stringify(package5Days, null, 2));
        console.log('```');
        
        console.log('\n🔧 Option 2: Direct Database Insert');
        console.log('Use MongoDB client to insert directly:');
        console.log('```javascript');
        console.log('db.creditpackages.insertOne(', JSON.stringify(package5Days, null, 2), ')');
        console.log('```');
        
        console.log('\n📋 PlanId Pattern for Daily Packages:');
        console.log('- trial_3days  ✅ (exists)');
        console.log('- trial_5days  ⭐ (to be created)');
        console.log('- trial_7days  ✅ (exists)');
        console.log('- trial_10days ✅ (could be created)');
        console.log('- trial_14days ✅ (could be created for 2-week trial)');
        
        return package5Days;
        
    } catch (error) {
        console.error('❌ Error creating 5-day package specification:', error.response?.data || error.message);
        throw error;
    }
}

// Function to update the backend endpoint with 5-day package
function showBackendUpdateCode() {
    console.log('\n🔧 Backend Code Update:');
    console.log('To add 5-day package, update apps/backend/routes/payment.js');
    console.log('In the /add-daily-packages endpoint, add this to dailyPackages array:');
    console.log(`
{
    planId: 'trial_5days',
    name: 'Gói Dùng Thử 5 Ngày',
    description: 'Trải nghiệm đầy đủ tính năng trong 5 ngày',
    price: 69000,
    durationType: 'days',
    durationValue: 5,
    durationMonths: null,
    isPopular: false,
    isActive: true
}`);
    
    console.log('\nThen redeploy backend and call:');
    console.log('POST https://aistory-backend.onrender.com/api/payment/add-daily-packages');
}

add5DayPackage()
    .then(() => {
        console.log('\n🎉 5-day package specification completed!');
        showBackendUpdateCode();
    })
    .catch(error => {
        console.error('💥 Process failed:', error.message);
    });