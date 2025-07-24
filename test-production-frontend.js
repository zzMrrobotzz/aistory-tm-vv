const axios = require('./apps/backend/node_modules/axios').default;

const PRODUCTION_API_URL = 'https://aistory-backend.onrender.com/api';
const PRODUCTION_FRONTEND_URL = 'https://aistorymmo.top';

async function testProductionIntegration() {
    try {
        console.log('🔍 TESTING PRODUCTION FRONTEND INTEGRATION...\n');
        
        // Step 1: Test Backend API
        console.log('1️⃣ Testing Production Backend API...');
        const packagesResponse = await axios.get(`${PRODUCTION_API_URL}/packages`);
        const packages = packagesResponse.data.packages;
        
        console.log(`✅ Backend API: Found ${packages.length} packages`);
        packages.forEach((pkg, index) => {
            let duration = 'Unknown';
            if (pkg.durationType === 'days') {
                duration = `${pkg.durationValue} ngày`;
            } else if (pkg.durationType === 'months' || pkg.durationMonths) {
                const months = pkg.durationValue || pkg.durationMonths;
                duration = months >= 999 ? 'Vĩnh viễn' : `${months} tháng`;
            }
            
            console.log(`   ${index + 1}. ${pkg.name} - ${pkg.price.toLocaleString()} VND - ${duration}`);
        });
        
        // Step 2: Test CORS
        console.log('\n2️⃣ Testing CORS headers...');
        try {
            const corsResponse = await axios.options(`${PRODUCTION_API_URL}/packages`);
            console.log('✅ CORS preflight successful');
        } catch (error) {
            console.log('⚠️ CORS preflight may have issues:', error.message);
        }
        
        // Step 3: Check API response format
        console.log('\n3️⃣ Checking API response format...');
        const samplePackage = packages[0];
        console.log('📋 Sample package structure:');
        console.log(JSON.stringify(samplePackage, null, 2));
        
        // Step 4: Frontend compatibility check
        console.log('\n4️⃣ Frontend compatibility check...');
        const requiredFields = ['_id', 'planId', 'name', 'price'];
        const missingFields = [];
        
        packages.forEach((pkg, index) => {
            requiredFields.forEach(field => {
                if (!pkg[field] && field !== 'price' || (field === 'price' && pkg[field] === undefined)) {
                    missingFields.push(`Package ${index + 1} missing ${field}`);
                }
            });
        });
        
        if (missingFields.length === 0) {
            console.log('✅ All packages have required fields for frontend');
        } else {
            console.log('❌ Missing fields found:');
            missingFields.forEach(msg => console.log(`   - ${msg}`));
        }
        
        // Step 5: Check API URL in frontend
        console.log('\n5️⃣ Frontend API endpoint check...');
        console.log(`🔍 Frontend should fetch from: ${PRODUCTION_API_URL}/packages`);
        console.log('🌐 Check browser console for network requests');
        console.log('📱 Open DevTools → Network tab → Refresh page');
        
        // Step 6: Debugging instructions
        console.log('\n6️⃣ Debugging instructions for frontend:');
        console.log('🔧 1. Open https://aistorymmo.top in browser');
        console.log('🔧 2. Press F12 to open DevTools');
        console.log('🔧 3. Go to Network tab');
        console.log('🔧 4. Navigate to pricing page');
        console.log('🔧 5. Look for API call to /packages');
        console.log('🔧 6. Check Console tab for JavaScript errors');
        
        console.log('\n7️⃣ Common issues and fixes:');
        console.log('❌ No API call visible → Frontend not calling API');
        console.log('❌ API call fails → CORS or network issue');
        console.log('❌ API call succeeds but no display → Frontend rendering issue');
        console.log('❌ Wrong API URL → Check frontend API configuration');
        
        return {
            success: true,
            packagesCount: packages.length,
            apiWorking: true,
            frontendUrl: PRODUCTION_FRONTEND_URL,
            apiUrl: PRODUCTION_API_URL
        };
        
    } catch (error) {
        console.error('\n❌ Production integration test failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Run production test
testProductionIntegration()
    .then(result => {
        if (result.success) {
            console.log('\n🎯 PRODUCTION BACKEND IS WORKING!');
            console.log(`📊 API has ${result.packagesCount} packages ready`);
            console.log('\n🔍 Next steps:');
            console.log('1. Check browser console for errors');
            console.log('2. Verify frontend is calling correct API endpoint');
            console.log('3. Check for CORS or network issues');
            console.log('4. Ensure frontend code was deployed correctly');
        } else {
            console.log('\n❌ Production API has issues');
        }
    })
    .catch(error => {
        console.error('💥 Test failed:', error);
    });
