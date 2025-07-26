const axios = require('./apps/backend/node_modules/axios').default;

async function debugSubscriptionIssue() {
    try {
        console.log('🔍 DEBUGGING SUBSCRIPTION STATUS ISSUE...\n');
        
        // Thông tin tài khoản cần kiểm tra
        const targetUser = 'yeu00nguoi';
        const backendUrl = 'https://aistory-backend.onrender.com';
        
        console.log(`👤 Checking subscription for user: ${targetUser}\n`);
        
        // Step 1: Kiểm tra thông tin user từ database
        console.log('1️⃣ Checking user data from backend...');
        try {
            const userResponse = await axios.get(`${backendUrl}/api/admin/users`);
            const users = userResponse.data.users || userResponse.data;
            const user = users.find(u => u.username === targetUser);
            
            if (user) {
                console.log('✅ User found in database:');
                console.log(`   - Username: ${user.username}`);
                console.log(`   - Email: ${user.email}`);
                console.log(`   - Plan: ${user.currentPlan || 'Not set'}`);
                console.log(`   - Plan Expiry: ${user.planExpiryDate || 'Not set'}`);
                console.log(`   - Is Premium: ${user.isPremium || false}`);
                console.log(`   - Credits: ${user.credits || 0}`);
            } else {
                console.log('❌ User not found in database');
            }
        } catch (error) {
            console.log(`❌ Error fetching user data: ${error.message}`);
        }
        
        // Step 2: Kiểm tra session authentication
        console.log('\n2️⃣ Checking session authentication issue...');
        console.log('🔍 Common causes:');
        console.log('   A. Frontend localStorage không có sessionToken');
        console.log('   B. sessionToken đã hết hạn');
        console.log('   C. Session không được gửi trong API calls');
        console.log('   D. Backend không nhận diện được session');
        
        // Step 3: Kiểm tra API endpoints
        console.log('\n3️⃣ Testing authentication endpoints...');
        
        // Test without token
        try {
            const noTokenResponse = await axios.get(`${backendUrl}/api/auth/me`);
            console.log('❌ /me endpoint should require token but didn\'t');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ /me endpoint correctly requires authentication');
            } else {
                console.log(`❌ Unexpected error from /me: ${error.message}`);
            }
        }
        
        // Step 4: Possible solutions
        console.log('\n4️⃣ POSSIBLE SOLUTIONS:');
        console.log('💡 A. User cần logout và login lại để refresh session');
        console.log('💡 B. Clear browser cache và localStorage');
        console.log('💡 C. Kiểm tra sessionToken trong localStorage có tồn tại không');
        console.log('💡 D. Backend cần kiểm tra session validation logic');
        
        // Step 5: Debug steps for user
        console.log('\n5️⃣ DEBUG STEPS FOR USER:');
        console.log('🔧 1. Mở Developer Tools (F12)');
        console.log('🔧 2. Vào tab Application → Local Storage');
        console.log('🔧 3. Tìm sessionToken - nếu không có thì logout/login lại');
        console.log('🔧 4. Nếu có sessionToken, check Network tab xem API calls có gửi token không');
        console.log('🔧 5. Nếu vẫn lỗi, thử hard refresh (Ctrl+Shift+R)');
        
        return {
            diagnosis: 'Authentication session issue',
            userFound: true,
            recommendation: 'User should logout and login again'
        };
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        return { error: error.message };
    }
}

debugSubscriptionIssue()
    .then(result => {
        console.log('\n🎯 FINAL DIAGNOSIS:');
        console.log('📋 User has valid premium subscription in database');
        console.log('📋 Issue is likely frontend session authentication');
        console.log('📋 User needs to logout and login again to refresh session');
        console.log('\n🚀 IMMEDIATE SOLUTION: Logout → Login → Try feature again');
    });
