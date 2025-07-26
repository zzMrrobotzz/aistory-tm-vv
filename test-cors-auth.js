const axios = require('./apps/backend/node_modules/axios').default;

async function testCORSAndAuth() {
    try {
        console.log('🔧 TESTING CORS AND AUTH ISSUES...\n');
        
        // Test 1: Basic packages API (should work)
        console.log('1️⃣ Testing basic packages API...');
        try {
            const packagesResponse = await axios.get('https://aistory-backend.onrender.com/api/packages');
            console.log(`✅ Packages API works: ${packagesResponse.data.packages.length} packages`);
        } catch (error) {
            console.log(`❌ Packages API failed: ${error.message}`);
        }
        
        // Test 2: Auth endpoints (causing CORS issues)
        console.log('\n2️⃣ Testing auth endpoints...');
        
        try {
            const authResponse = await axios.get('https://aistory-backend.onrender.com/api/auth/me', {
                headers: {
                    'Origin': 'https://aistorymmo.top'
                }
            });
            console.log('✅ Auth endpoint works');
        } catch (error) {
            console.log(`❌ Auth endpoint failed: ${error.message}`);
            if (error.message.includes('CORS')) {
                console.log('🚨 CORS issue detected!');
            }
        }
        
        // Test 3: Session status endpoint
        console.log('\n3️⃣ Testing session-status endpoint...');
        try {
            const sessionResponse = await axios.get('https://aistory-backend.onrender.com/api/auth/session-status', {
                headers: {
                    'Origin': 'https://aistorymmo.top'
                }
            });
            console.log('✅ Session status works');
        } catch (error) {
            console.log(`❌ Session status failed: ${error.message}`);
        }
        
        // Test 4: CORS headers specifically
        console.log('\n4️⃣ Testing CORS headers...');
        try {
            const corsTestResponse = await axios.options('https://aistory-backend.onrender.com/api/auth/me', {
                headers: {
                    'Origin': 'https://aistorymmo.top',
                    'Access-Control-Request-Method': 'GET',
                    'Access-Control-Request-Headers': 'content-type'
                }
            });
            console.log('✅ CORS preflight successful');
            console.log('📋 CORS headers:', Object.keys(corsTestResponse.headers));
        } catch (error) {
            console.log(`❌ CORS preflight failed: ${error.message}`);
        }
        
        console.log('\n🎯 DIAGNOSIS:');
        console.log('The frontend is trying to access auth endpoints but CORS is blocking them.');
        console.log('\n🔧 SOLUTIONS:');
        console.log('1. Backend needs to be redeployed with updated CORS config');
        console.log('2. Or auth routes are not properly configured');
        console.log('3. Or there are server errors in auth endpoints');
        
        console.log('\n⚡ IMMEDIATE FIXES:');
        console.log('- Redeploy backend to Render.com');
        console.log('- Check backend logs for auth route errors');
        console.log('- Verify auth routes are working with curl/Postman');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testCORSAndAuth();
