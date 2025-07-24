const axios = require('./apps/backend/node_modules/axios').default;

async function testCORSFix() {
    try {
        console.log('🔧 TESTING CORS FIX...\n');
        
        // Test 1: Direct API call
        console.log('1️⃣ Testing direct API call...');
        const response = await axios.get('https://aistory-backend.onrender.com/api/packages');
        console.log(`✅ Direct API call works: ${response.data.packages.length} packages`);
        
        // Test 2: Check CORS headers
        console.log('\n2️⃣ Testing CORS headers...');
        const corsTest = await axios.get('https://aistory-backend.onrender.com/api/packages', {
            headers: {
                'Origin': 'https://aistorymmo.top'
            }
        });
        
        console.log('✅ CORS test successful');
        console.log('📋 Response headers:', Object.keys(corsTest.headers));
        
        // Test 3: Check specific CORS headers
        console.log('\n3️⃣ Checking CORS response headers...');
        const corsHeaders = [
            'access-control-allow-origin',
            'access-control-allow-methods', 
            'access-control-allow-headers'
        ];
        
        corsHeaders.forEach(header => {
            if (corsTest.headers[header]) {
                console.log(`✅ ${header}: ${corsTest.headers[header]}`);
            } else {
                console.log(`❌ Missing: ${header}`);
            }
        });
        
        console.log('\n🚀 CORS FIX RECOMMENDATIONS:');
        console.log('1. Backend redeploy may be needed');
        console.log('2. Check if Render.com deployed latest changes');
        console.log('3. Clear browser cache');
        console.log('4. Try hard refresh (Ctrl+F5)');
        
        console.log('\n🔧 IMMEDIATE FIXES:');
        console.log('- Add "Access-Control-Allow-Origin: *" header temporarily');
        console.log('- Or ensure backend is deployed with aistorymmo.top in CORS');
        
    } catch (error) {
        console.error('\n❌ CORS test failed:', error.message);
        
        if (error.message.includes('CORS')) {
            console.log('\n🔧 CORS ERROR DETECTED!');
            console.log('Backend needs to allow https://aistorymmo.top');
            console.log('Check backend deployment status on Render.com');
        }
    }
}

testCORSFix();
