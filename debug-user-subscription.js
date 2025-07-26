const axios = require('./apps/backend/node_modules/axios').default;

async function debugUserSubscriptionStatus() {
    try {
        console.log('🔍 DEBUGGING USER SUBSCRIPTION STATUS...\n');
        
        const backendUrl = 'https://aistory-backend.onrender.com';
        const targetUsername = 'yeu00nguoi';
        
        // Bước 1: Kiểm tra user data từ admin API
        console.log('1️⃣ Fetching user data from admin API...');
        try {
            // Giả lập một request từ admin để lấy user data
            const response = await axios.get(`${backendUrl}/api/admin/users`);
            const users = response.data.users || response.data;
            const user = users.find(u => u.username === targetUsername);
            
            if (user) {
                console.log('✅ User found in database:');
                console.log(`   - ID: ${user._id}`);
                console.log(`   - Username: ${user.username}`);
                console.log(`   - Email: ${user.email}`);
                console.log(`   - Subscription Type: ${user.subscriptionType || 'free'}`);
                console.log(`   - Subscription Expires: ${user.subscriptionExpiresAt || 'Not set'}`);
                console.log(`   - Is Active: ${user.isActive !== false ? 'Yes' : 'No'}`);
                console.log(`   - Credits: ${user.remainingCredits || user.credits || 0}`);
                
                // Kiểm tra thời gian hết hạn
                if (user.subscriptionExpiresAt) {
                    const expiryDate = new Date(user.subscriptionExpiresAt);
                    const now = new Date();
                    const timeLeft = expiryDate.getTime() - now.getTime();
                    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
                    
                    console.log('\n📅 Subscription Analysis:');
                    console.log(`   - Expiry Date: ${expiryDate.toLocaleDateString('vi-VN')} ${expiryDate.toLocaleTimeString('vi-VN')}`);
                    console.log(`   - Current Time: ${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN')}`);
                    console.log(`   - Days Left: ${daysLeft}`);
                    console.log(`   - Is Expired: ${timeLeft <= 0 ? 'YES' : 'NO'}`);
                    
                    if (timeLeft <= 0) {
                        console.log('❌ PROBLEM FOUND: Subscription has expired!');
                        console.log('💡 This explains why user is prompted to upgrade');
                    } else {
                        console.log('✅ Subscription is still valid');
                    }
                }
                
                // Kiểm tra subscription type
                console.log('\n🔍 Subscription Type Analysis:');
                const subType = user.subscriptionType || 'free';
                
                if (subType === 'free') {
                    console.log('❌ PROBLEM FOUND: User has free subscription!');
                    console.log('💡 This explains why user is prompted to upgrade');
                } else if (subType === 'lifetime') {
                    console.log('✅ User has lifetime subscription - should work');
                } else if (subType.includes('premium')) {
                    console.log(`✅ User has premium subscription: ${subType}`);
                } else if (subType.includes('trial')) {
                    console.log(`⚠️ User has trial subscription: ${subType}`);
                    if (!user.subscriptionExpiresAt) {
                        console.log('❌ PROBLEM: Trial subscription but no expiry date set!');
                    }
                } else {
                    console.log(`⚠️ Unknown subscription type: ${subType}`);
                }
                
                return {
                    userFound: true,
                    subscriptionType: subType,
                    isExpired: user.subscriptionExpiresAt ? new Date() > new Date(user.subscriptionExpiresAt) : false,
                    hasValidSubscription: subType !== 'free' && (!user.subscriptionExpiresAt || new Date() < new Date(user.subscriptionExpiresAt))
                };
                
            } else {
                console.log('❌ User not found in database');
                return { userFound: false };
            }
        } catch (error) {
            console.log(`❌ Error fetching user data: ${error.message}`);
            return { error: error.message };
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        return { error: error.message };
    }
}

// Bước 2: Kiểm tra authentication flow
async function checkAuthenticationFlow() {
    console.log('\n2️⃣ CHECKING AUTHENTICATION FLOW...');
    
    const backendUrl = 'https://aistory-backend.onrender.com';
    
    // Test /me endpoint without token
    console.log('🔍 Testing /me endpoint without token...');
    try {
        await axios.get(`${backendUrl}/api/auth/me`);
        console.log('❌ /me endpoint should require authentication but didn\'t');
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('✅ /me endpoint correctly requires authentication');
        } else {
            console.log(`❌ Unexpected error: ${error.message}`);
        }
    }
    
    // Test session-status endpoint
    console.log('\n🔍 Testing session-status endpoint...');
    try {
        await axios.get(`${backendUrl}/api/auth/session-status`);
        console.log('❌ session-status should require token but didn\'t');
    } catch (error) {
        if (error.response && (error.response.status === 400 || error.response.status === 401)) {
            console.log('✅ session-status endpoint correctly requires token');
        } else {
            console.log(`❌ Unexpected error: ${error.message}`);
        }
    }
}

debugUserSubscriptionStatus()
    .then(async (result) => {
        if (result.userFound) {
            console.log('\n🎯 DIAGNOSIS SUMMARY:');
            console.log(`📋 User subscription type: ${result.subscriptionType}`);
            console.log(`📋 Subscription expired: ${result.isExpired ? 'YES' : 'NO'}`);
            console.log(`📋 Has valid subscription: ${result.hasValidSubscription ? 'YES' : 'NO'}`);
            
            if (!result.hasValidSubscription) {
                console.log('\n🚨 ROOT CAUSE IDENTIFIED:');
                if (result.subscriptionType === 'free') {
                    console.log('❌ User has FREE subscription but believes they have premium');
                    console.log('💡 Possible causes:');
                    console.log('   - Payment completed but user subscription not updated');
                    console.log('   - Database issue during payment processing');
                    console.log('   - Admin panel showing incorrect information');
                } else if (result.isExpired) {
                    console.log('❌ User subscription has EXPIRED');
                    console.log('💡 User needs to renew their subscription');
                } else {
                    console.log('❌ Subscription configuration issue');
                }
            } else {
                console.log('\n✅ SUBSCRIPTION IS VALID');
                console.log('💡 Issue might be:');
                console.log('   - Frontend not sending sessionToken in API calls');
                console.log('   - User needs to logout and login again');
                console.log('   - Browser cache issue');
            }
        }
        
        await checkAuthenticationFlow();
        
        console.log('\n🚀 RECOMMENDED ACTIONS:');
        console.log('1. Check Admin Panel user details for accurate subscription info');
        console.log('2. If subscription is valid but user still has issues: logout/login');
        console.log('3. If subscription is expired/free: check payment history');
        console.log('4. Clear browser cache and localStorage');
    });
