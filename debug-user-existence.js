const axios = require('./apps/backend/node_modules/axios').default;

async function checkUserExistence() {
    try {
        console.log('🔍 CHECKING USER EXISTENCE IN DATABASE...\n');
        
        const backendUrl = 'https://aistory-backend.onrender.com';
        const targetUsername = 'yeu00nguoi';
        const targetEmail = 'yeu00nguoi@gmail.com';
        
        // Thử nhiều cách để tìm user
        console.log('1️⃣ Attempting to find user via different endpoints...');
        
        // Method 1: Admin users endpoint
        console.log('\n🔍 Method 1: Admin users API...');
        try {
            const response = await axios.get(`${backendUrl}/api/admin/users`);
            const users = response.data.users || response.data || [];
            
            console.log(`📊 Total users in database: ${users.length}`);
            
            // Tìm theo username
            const userByUsername = users.find(u => u.username === targetUsername);
            const userByEmail = users.find(u => u.email === targetEmail);
            
            if (userByUsername) {
                console.log('✅ User found by username!');
                console.log(JSON.stringify(userByUsername, null, 2));
            } else {
                console.log('❌ User not found by username');
            }
            
            if (userByEmail) {
                console.log('✅ User found by email!');
                console.log(JSON.stringify(userByEmail, null, 2));
            } else {
                console.log('❌ User not found by email');
            }
            
            // Hiển thị một số users để tham khảo
            console.log('\n📋 Sample users in database:');
            users.slice(0, 5).forEach((user, index) => {
                console.log(`${index + 1}. Username: ${user.username}, Email: ${user.email}, Subscription: ${user.subscriptionType || 'free'}`);
            });
            
        } catch (error) {
            console.log(`❌ Admin users API failed: ${error.message}`);
        }
        
        // Method 2: Try to authenticate as the user
        console.log('\n🔍 Method 2: Attempting authentication...');
        try {
            // Note: We don't have the password, so this will likely fail
            // But we can see if the username exists based on the error message
            const loginResponse = await axios.post(`${backendUrl}/api/auth/login`, {
                username: targetUsername,
                password: 'test123' // Random password
            });
            console.log('❓ Unexpected login success:', loginResponse.data);
        } catch (loginError) {
            if (loginError.response) {
                const status = loginError.response.status;
                const message = loginError.response.data.msg || loginError.response.data.message;
                
                if (status === 400 && message.includes('Invalid credentials')) {
                    console.log('✅ User exists but password is wrong (expected)');
                } else if (status === 400 && message.includes('User not found')) {
                    console.log('❌ User does not exist in authentication system');
                } else {
                    console.log(`⚠️ Login attempt returned: ${status} - ${message}`);
                }
            } else {
                console.log(`❌ Login request failed: ${loginError.message}`);
            }
        }
        
        // Method 3: Check recent payments for this user
        console.log('\n🔍 Method 3: Checking payment history...');
        try {
            const paymentResponse = await axios.get(`${backendUrl}/api/admin/payments`);
            const payments = paymentResponse.data.payments || paymentResponse.data || [];
            
            const userPayments = payments.filter(p => 
                (p.userId && p.userId.username === targetUsername) ||
                (p.userKey === targetUsername) ||
                (p.email === targetEmail)
            );
            
            console.log(`💳 Found ${userPayments.length} payments for this user`);
            userPayments.forEach((payment, index) => {
                console.log(`${index + 1}. Payment ID: ${payment._id}, Status: ${payment.status}, Plan: ${payment.planId}, Amount: ${payment.price}`);
            });
            
        } catch (error) {
            console.log(`❌ Payment check failed: ${error.message}`);
        }
        
        console.log('\n🎯 CONCLUSION:');
        console.log('💡 If user is not found in database but shows in admin panel:');
        console.log('   - Admin panel might be showing cached/demo data');
        console.log('   - Different database environment (staging vs production)');
        console.log('   - Admin panel connected to different backend');
        console.log('\n💡 If user exists but has free subscription:');
        console.log('   - Payment was not processed correctly');
        console.log('   - Webhook failed to update user subscription');
        console.log('   - Manual subscription update needed');
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    }
}

checkUserExistence();
