const axios = require('./apps/backend/node_modules/axios').default;

const API_URL = 'https://aistory-backend.onrender.com/api';

async function addDailyPackages() {
    try {
        console.log('🚀 Adding daily trial packages via API...\n');
        
        console.log('📦 Calling add-daily-packages endpoint...');
        const response = await axios.post(`${API_URL}/payment/add-daily-packages`);
        
        const result = response.data;
        console.log('✅ API Response:', result.message);
        
        if (result.packages && result.packages.length > 0) {
            console.log('\n📋 Created packages:');
            result.packages.forEach((pkg, index) => {
                console.log(`${index + 1}. ${pkg.name}`);
                console.log(`   - Plan ID: ${pkg.planId}`);
                console.log(`   - Price: ${pkg.price.toLocaleString()} VND`);
                console.log(`   - Duration: ${pkg.durationValue} ${pkg.durationType}`);
                console.log('');
            });
        } else {
            console.log('⚠️ No new packages were created (may already exist)');
        }
        
        // Verify by fetching all packages
        console.log('🔍 Fetching all packages to verify...');
        const packagesResponse = await axios.get(`${API_URL}/packages`);
        const allPackages = packagesResponse.data.packages;
        
        console.log('\n📋 All available packages:');
        allPackages.forEach((pkg, index) => {
            // Determine duration display
            let duration = 'Unknown';
            if (pkg.durationType === 'days') {
                duration = `${pkg.durationValue} ngày`;
            } else if (pkg.durationType === 'months' || pkg.durationMonths) {
                const months = pkg.durationValue || pkg.durationMonths;
                duration = months >= 999 ? 'Vĩnh viễn' : `${months} tháng`;
            }
            
            console.log(`${index + 1}. ${pkg.name}`);
            console.log(`   - Plan ID: ${pkg.planId}`);
            console.log(`   - Price: ${pkg.price.toLocaleString()} VND`);
            console.log(`   - Duration: ${duration}`);
            console.log(`   - Popular: ${pkg.isPopular ? 'Yes' : 'No'}`);
            console.log('');
        });
        
        console.log('🎉 Daily trial packages added successfully!');
        return allPackages;
        
    } catch (error) {
        console.error('❌ Error adding daily trial packages:', error.response?.data || error.message);
        throw error;
    }
}

addDailyPackages()
    .then(() => {
        console.log('✅ Process completed successfully!');
    })
    .catch(error => {
        console.error('💥 Process failed:', error.message);
    });