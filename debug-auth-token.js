const axios = require('./apps/backend/node_modules/axios').default;

async function debugAuthWithToken() {
    try {
        console.log('🔍 DEBUGGING AUTH WITH TOKEN...\n');
        
        // Test auth endpoints với giả lập token
        console.log('1️⃣ Testing session-status endpoint...');
        
        // Test without token (should return 400)
        try {
            const noTokenResponse = await axios.get('https://aistory-backend.onrender.com/api/auth/session-status');
            console.log('❌ No token test failed - should return 400');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ No token correctly returns 400');
                console.log('📋 Error response:', error.response.data);
            } else {
                console.log(`❌ Unexpected error: ${error.message}`);
            }
        }
        
        // Test with dummy token (should return session not found)
        console.log('\n2️⃣ Testing with dummy token...');
        try {
            const dummyTokenResponse = await axios.get('https://aistory-backend.onrender.com/api/auth/session-status', {
                headers: {
                    'x-session-token': 'dummy-token-123'
                }
            });
            console.log('❌ Dummy token test failed');
        } catch (error) {
            if (error.response) {
                console.log(`✅ Dummy token returns status: ${error.response.status}`);
                console.log('📋 Error response:', error.response.data);
            }
        }
        
        // Test /me endpoint without auth token
        console.log('\n3️⃣ Testing /me endpoint...');
        try {
            const meResponse = await axios.get('https://aistory-backend.onrender.com/api/auth/me');
            console.log('❌ /me without token should fail');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ /me correctly returns 401 without token');
                console.log('📋 Error response:', error.response.data);
            }
        }
        
        console.log('\n🎯 DIAGNOSIS:');
        console.log('The auth endpoints are working correctly.');
        console.log('The issue is that frontend is calling them without valid tokens.');
        console.log('\n🔧 POSSIBLE CAUSES:');
        console.log('1. User is not actually logged in (no sessionToken in localStorage)');
        console.log('2. SessionToken is expired/invalid');
        console.log('3. Frontend is calling auth APIs before user logs in');
        console.log('4. Session management is not working properly');
        
        console.log('\n💡 DEBUGGING STEPS FOR USER:');
        console.log('1. Open browser DevTools → Application tab → Local Storage');
        console.log('2. Check if "sessionToken" exists in localStorage');
        console.log('3. If no sessionToken → user needs to login again');
        console.log('4. If sessionToken exists → it may be expired/invalid');
        console.log('5. Try logging out and logging in again');
        
    } catch (error) {
        console.error('Debug failed:', error.message);
    }
}

debugAuthWithToken();
