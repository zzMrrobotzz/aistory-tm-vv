require('dotenv').config();
const mongoose = require('./apps/backend/node_modules/mongoose');

async function quickTest() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
        
        await mongoose.connect('mongodb+srv://aistory:aistory123@cluster0.cgrvn.mongodb.net/aistory');
        console.log('✅ Connected to MongoDB\n');
        
        const User = require('./apps/backend/models/User');
        
        // Get total users
        const totalUsers = await User.countDocuments();
        console.log(`📊 Total users in database: ${totalUsers}`);
        
        // Find users with similar names
        const users = await User.find({
            username: { $regex: /yeu.*nguoi/i }
        }, 'username email subscriptionType subscriptionExpiresAt');
        
        console.log('\n👥 Users matching "yeu*nguoi":');
        users.forEach((user, index) => {
            console.log(`${index + 1}. ${user.username} (${user.email})`);
            console.log(`   Subscription: ${user.subscriptionType || 'free'}`);
            if (user.subscriptionExpiresAt) {
                const now = new Date();
                const expiry = new Date(user.subscriptionExpiresAt);
                const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                console.log(`   Expires: ${expiry.toLocaleDateString('vi-VN')} (${daysLeft} days left)`);
                console.log(`   Status: ${daysLeft > 0 ? '✅ Active' : '❌ Expired'}`);
            }
            console.log('');
        });
        
        if (users.length === 0) {
            console.log('❌ No users found matching "yeu*nguoi"');
            
            // Show first 5 users as sample
            const sampleUsers = await User.find({}, 'username email subscriptionType').limit(5);
            console.log('\n📋 Sample users in database:');
            sampleUsers.forEach((user, index) => {
                console.log(`${index + 1}. ${user.username} (${user.email}) - ${user.subscriptionType || 'free'}`);
            });
        }
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

quickTest();
