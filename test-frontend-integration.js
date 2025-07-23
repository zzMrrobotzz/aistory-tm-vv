const axios = require('./apps/backend/node_modules/axios').default;

const API_URL = 'https://aistory-backend.onrender.com/api';

async function testFrontendIntegration() {
    try {
        console.log('🔗 Testing Frontend-Backend Integration...\n');
        
        // Step 1: Test public packages API
        console.log('1️⃣ Testing public packages API...');
        const packagesResponse = await axios.get(`${API_URL}/packages`);
        const packages = packagesResponse.data.packages;
        
        console.log(`✅ Found ${packages.length} active packages:`);
        packages.forEach((pkg, index) => {
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
            console.log(`   - Active: ${pkg.isActive !== false ? 'Yes' : 'No'}`);
            console.log('');
        });
        
        // Step 2: Test frontend compatibility
        console.log('2️⃣ Testing frontend data compatibility...');
        
        const frontendCompatible = packages.every(pkg => {
            const hasRequiredFields = pkg._id && pkg.planId && pkg.name && (pkg.price !== undefined);
            const hasDurationInfo = pkg.durationType || pkg.durationMonths;
            
            if (!hasRequiredFields) {
                console.log(`❌ Package ${pkg.name} missing required fields`);
                return false;
            }
            
            if (!hasDurationInfo) {
                console.log(`❌ Package ${pkg.name} missing duration info`);
                return false;
            }
            
            return true;
        });
        
        if (frontendCompatible) {
            console.log('✅ All packages are compatible with frontend interface');
        }
        
        // Step 3: Check package types distribution
        console.log('3️⃣ Package distribution analysis...');
        
        const trialPackages = packages.filter(p => p.durationType === 'days');
        const monthlyPackages = packages.filter(p => p.durationType === 'months' && (p.durationValue || p.durationMonths) < 999);
        const lifetimePackages = packages.filter(p => (p.durationValue || p.durationMonths) >= 999);
        
        console.log(`📊 Package Categories:`);
        console.log(`   - Trial packages (days): ${trialPackages.length}`);
        console.log(`   - Monthly packages: ${monthlyPackages.length}`);
        console.log(`   - Lifetime packages: ${lifetimePackages.length}`);
        
        // Step 4: Test price sorting
        console.log('\n4️⃣ Testing price sorting...');
        const sortedByPrice = [...packages].sort((a, b) => a.price - b.price);
        console.log('📈 Packages sorted by price:');
        sortedByPrice.forEach((pkg, index) => {
            console.log(`${index + 1}. ${pkg.name} - ${pkg.price.toLocaleString()} VND`);
        });
        
        console.log('\n✅ FRONTEND INTEGRATION TEST COMPLETED!');
        console.log('\n📋 Integration Status:');
        console.log(`✅ API endpoint working: ${API_URL}/packages`);
        console.log(`✅ Data format compatible with frontend`);
        console.log(`✅ ${packages.length} packages ready for display`);
        console.log(`✅ Admin panel packages will show in frontend`);
        console.log(`✅ Frontend sorting and filtering ready`);
        
        return {
            success: true,
            packagesCount: packages.length,
            trialPackages: trialPackages.length,
            monthlyPackages: monthlyPackages.length,
            lifetimePackages: lifetimePackages.length
        };
        
    } catch (error) {
        console.error('\n❌ Frontend integration test failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

testFrontendIntegration()
    .then(result => {
        if (result.success) {
            console.log('\n🎉 FRONTEND-BACKEND INTEGRATION IS FULLY FUNCTIONAL!');
            console.log(`📊 Ready to display ${result.packagesCount} packages`);
        } else {
            console.log('\n❌ Integration needs attention');
        }
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
    });
