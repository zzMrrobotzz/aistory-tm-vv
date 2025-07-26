const axios = require('./apps/backend/node_modules/axios').default;

async function findCorrectUser() {
    try {
        console.log('🔍 FINDING CORRECT USER ACCOUNT...\n');
        
        const backendUrl = 'https://aistory-backend.onrender.com';
        
        // Get all users
        console.log('1️⃣ Getting all users from database...');
        const response = await axios.get(`${backendUrl}/api/admin/users`);
        const users = response.data.users || response.data || [];
        
        console.log(`📊 Total users: ${users.length}\n`);
        
        // Look for similar usernames to yeu00nguoi
        console.log('2️⃣ Searching for similar usernames...');
        const similarUsers = users.filter(user => 
            user.username.includes('yeu') || 
            user.email.includes('yeu') ||
            user.username.includes('nguoi')
        );
        
        console.log(`Found ${similarUsers.length} similar users:`);
        similarUsers.forEach((user, index) => {
            console.log(`\n${index + 1}. User Details:`);
            console.log(`   - Username: ${user.username}`);
            console.log(`   - Email: ${user.email}`);
            console.log(`   - Subscription: ${user.subscriptionType || 'free'}`);
            console.log(`   - Expires: ${user.subscriptionExpiresAt || 'N/A'}`);
            console.log(`   - Active: ${user.isActive !== false ? 'Yes' : 'No'}`);
            console.log(`   - Created: ${user.createdAt || 'N/A'}`);
            
            // Check if subscription is valid
            if (user.subscriptionExpiresAt) {
                const now = new Date();
                const expiry = new Date(user.subscriptionExpiresAt);
                const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                console.log(`   - Days Left: ${daysLeft}`);
                console.log(`   - Status: ${daysLeft > 0 ? '✅ Active' : '❌ Expired'}`);
            }
        });
        
        // Check users with premium subscriptions
        console.log('\n3️⃣ All users with premium subscriptions:');
        const premiumUsers = users.filter(user => 
            user.subscriptionType && 
            user.subscriptionType !== 'free' &&
            !user.subscriptionType.startsWith('trial_')
        );
        
        console.log(`Found ${premiumUsers.length} premium users:`);
        premiumUsers.forEach((user, index) => {
            const now = new Date();
            const expiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
            const isValid = expiry ? expiry > now : false;
            
            console.log(`\n${index + 1}. ${user.username} (${user.email})`);
            console.log(`   - Plan: ${user.subscriptionType}`);
            console.log(`   - Expires: ${user.subscriptionExpiresAt || 'Never'}`);
            console.log(`   - Valid: ${isValid ? '✅ Yes' : '❌ No'}`);
        });
        
        // Check for exact username match with different casing
        console.log('\n4️⃣ Checking for exact username variations...');
        const possibleUsernames = [
            'yeu00nguoi',
            'yeu00nguoi1', 
            'YEU00NGUOI',
            'Yeu00nguoi'
        ];
        
        possibleUsernames.forEach(username => {
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (user) {
                console.log(`✅ Found: ${username} -> Actual username: ${user.username}`);
                console.log(`   - Email: ${user.email}`);
                console.log(`   - Subscription: ${user.subscriptionType || 'free'}`);
            } else {
                console.log(`❌ Not found: ${username}`);
            }
        });
        
        console.log('\n🎯 ANALYSIS:');
        console.log('💡 Possible scenarios:');
        console.log('1. User login username is different from display name');
        console.log('2. User registered with slightly different username (yeu00nguoi1)');
        console.log('3. Admin panel shows user profile but different login credentials');
        console.log('4. User needs to login with correct username/password combination');
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Verify exact login credentials user is using');
        console.log('2. Check if yeu00nguoi1 is the correct username');
        console.log('3. If user registered as yeu00nguoi1, they should login with that username');
        console.log('4. Admin can update username if needed');
        
        return similarUsers;
        
    } catch (error) {
        console.error('❌ Search failed:', error.message);
        return [];
    }
}

findCorrectUser();
