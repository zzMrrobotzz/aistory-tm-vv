const axios = require('./apps/backend/node_modules/axios').default;

const API_URL = 'https://aistory-backend.onrender.com/api';

async function createDailyTrialPackages() {
    try {
        console.log('🚀 Creating daily trial packages via API...\n');
        
        // Register admin user for package creation
        const adminData = {
            username: 'admin_' + Date.now(),
            email: 'admin_' + Date.now() + '@temp.com',
            password: 'admin123456'
        };
        
        console.log('1️⃣ Registering admin user...');
        try {
            await axios.post(`${API_URL}/auth/register`, adminData);
            console.log('✅ Admin user registered');
        } catch (error) {
            console.log('⚠️ Admin registration may have failed, continuing...');
        }
        
        // Login to get token
        console.log('2️⃣ Logging in...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: adminData.email,
            password: adminData.password
        });
        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        
        // Check current packages
        console.log('3️⃣ Checking current packages...');
        const packagesResponse = await axios.get(`${API_URL}/packages`);
        const currentPackages = packagesResponse.data.packages;
        console.log('📦 Current packages:', currentPackages.map(p => ({ name: p.name, planId: p.planId })));
        
        // Check if trial packages already exist
        const hasTrialPackages = currentPackages.some(p => p.planId.includes('trial'));
        if (hasTrialPackages) {
            console.log('⚠️ Trial packages already exist, skipping creation');
            return;
        }
        
        console.log('4️⃣ Creating daily trial packages...');
        
        // Since we can't directly create packages via API, we'll use a different approach
        // Let's call the backend init-packages endpoint and modify it
        
        // Note: We need to add these packages directly in the database
        // For now, let's display what packages should be created
        
        console.log('📋 Daily trial packages to be created:');
        
        const trialPackages = [
            {
                planId: 'trial_3days',
                name: 'Gói Dùng Thử 3 Ngày',
                description: 'Trải nghiệm đầy đủ tính năng trong 3 ngày',
                price: 49000,
                durationType: 'days',
                durationValue: 3,
                isPopular: false
            },
            {
                planId: 'trial_7days', 
                name: 'Gói Dùng Thử 1 Tuần',
                description: 'Trải nghiệm đầy đủ tính năng trong 7 ngày',
                price: 99000,
                durationType: 'days',
                durationValue: 7,
                isPopular: true
            }
        ];
        
        trialPackages.forEach((pkg, index) => {
            console.log(`${index + 1}. ${pkg.name}`);
            console.log(`   - Plan ID: ${pkg.planId}`);
            console.log(`   - Price: ${pkg.price.toLocaleString()} VND`);
            console.log(`   - Duration: ${pkg.durationValue} ${pkg.durationType}`);
            console.log(`   - Popular: ${pkg.isPopular ? 'Yes' : 'No'}`);
            console.log('');
        });
        
        console.log('✅ Daily trial package specifications created!');
        console.log('📝 These packages need to be added to the database manually or via backend script');
        
        return trialPackages;
        
    } catch (error) {
        console.error('❌ Error creating daily trial packages:', error.response?.data || error.message);
        throw error;
    }
}

createDailyTrialPackages()
    .then(() => {
        console.log('🎉 Daily trial packages process completed!');
    })
    .catch(error => {
        console.error('💥 Process failed:', error.message);
    });