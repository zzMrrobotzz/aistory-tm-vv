const axios = require('./apps/backend/node_modules/axios').default;

async function debugProductionFrontend() {
    try {
        console.log('🔍 DEBUGGING PRODUCTION FRONTEND ISSUE...\n');
        
        // Step 1: Verify API is working
        console.log('1️⃣ Verifying Backend API...');
        const apiResponse = await axios.get('https://aistory-backend.onrender.com/api/packages');
        console.log(`✅ API Response: ${apiResponse.data.packages.length} packages available`);
        
        // Step 2: Check if pricing route exists
        console.log('\n2️⃣ Checking possible frontend issues...');
        console.log('❓ Frontend may not have /pricing route');
        console.log('❓ Frontend may not have Pricing component deployed');
        console.log('❓ Frontend may be using hardcoded data instead of API');
        
        // Step 3: Check what's actually deployed
        console.log('\n3️⃣ What to check in production frontend:');
        console.log('🔍 1. Visit https://aistorymmo.top/pricing directly');
        console.log('🔍 2. Check if page exists or shows 404');
        console.log('🔍 3. If page exists but no packages → API not called');
        console.log('🔍 4. Check Network tab for any API calls');
        
        // Step 4: Possible solutions
        console.log('\n4️⃣ Possible solutions:');
        console.log('💡 A. Frontend deployment missing Pricing component');
        console.log('💡 B. Frontend routing not configured for /pricing');
        console.log('💡 C. Frontend using old hardcoded data');
        console.log('💡 D. Frontend API endpoint misconfigured');
        
        // Step 5: Check what's in the current frontend
        console.log('\n5️⃣ Let me check current frontend structure...');
        
        return {
            apiWorking: true,
            packagesCount: apiResponse.data.packages.length
        };
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        return { apiWorking: false, error: error.message };
    }
}

debugProductionFrontend()
    .then(result => {
        if (result.apiWorking) {
            console.log('\n🎯 DIAGNOSIS: API IS WORKING, FRONTEND ISSUE');
            console.log('📋 Most likely causes:');
            console.log('1. Frontend production missing Pricing.tsx component');
            console.log('2. Frontend routing not configured');
            console.log('3. Frontend deployment didn\'t include latest changes');
            console.log('\n🚀 Solution: Redeploy frontend with latest code from repo');
        }
    });
