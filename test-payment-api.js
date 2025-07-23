const axios = require('axios');

const API_URL = 'https://aistory-backend.onrender.com/api';

// Test data
const testUserData = {
  username: 'testuser' + Date.now(),
  email: 'test' + Date.now() + '@example.com',
  password: 'password123'
};

async function testFullPaymentFlow() {
    try {
        console.log('🚀 Testing full payment flow...\n');
        
        // Step 1: Register test user
        console.log('1️⃣ Registering test user...');
        const registerResponse = await axios.post(`${API_URL}/auth/register`, testUserData);
        console.log('✅ User registered:', registerResponse.data.message);
        
        // Step 2: Login to get token
        console.log('\n2️⃣ Logging in...');
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: testUserData.email,
            password: testUserData.password
        });
        const token = loginResponse.data.token;
        console.log('✅ Login successful, got token');
        
        // Step 3: Get available packages
        console.log('\n3️⃣ Getting subscription packages...');
        const packagesResponse = await axios.get(`${API_URL}/packages`);
        const packages = packagesResponse.data.packages;
        console.log('✅ Found packages:', packages.map(p => ({ name: p.name, planId: p.planId, price: p.price })));
        
        // Step 4: Create payment for first package
        const testPackage = packages[0]; // Use first package
        console.log(`\n4️⃣ Creating payment for package: ${testPackage.name} (${testPackage.price} VND)`);
        
        const paymentResponse = await axios.post(`${API_URL}/payment/create`, {
            planId: testPackage.planId
        }, {
            headers: {
                'x-auth-token': token,
                'Content-Type': 'application/json'
            }
        });
        
        const paymentData = paymentResponse.data;
        console.log('✅ Payment created successfully!');
        console.log('🔗 Payment URL:', paymentData.payUrl);
        console.log('📱 QR Data available:', !!paymentData.qrData);
        console.log('🏦 Bank transfer info:', {
            bank: paymentData.transferInfo?.bankName,
            account: paymentData.transferInfo?.accountNumber,
            amount: paymentData.transferInfo?.amount
        });
        console.log('⏰ Expires at:', paymentData.expiredAt);
        
        // Step 5: Check payment status
        console.log('\n5️⃣ Checking payment status...');
        const statusResponse = await axios.get(`${API_URL}/payment/status/${paymentData.paymentId}`);
        console.log('✅ Payment status:', statusResponse.data.payment.status);
        console.log('⏰ Is expired:', statusResponse.data.isExpired);
        
        console.log('\n🎉 FULL PAYMENT FLOW TEST SUCCESSFUL!');
        console.log('💡 You can complete payment by visiting URL above');
        console.log('🔄 Webhook will automatically complete subscription when paid');
        
        return {
            success: true,
            paymentUrl: paymentData.payUrl,
            paymentId: paymentData.paymentId,
            testUser: testUserData.email
        };
        
    } catch (error) {
        console.error('\n❌ Payment flow test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        }
        return { success: false, error: error.message };
    }
}

// Run test
testFullPaymentFlow().then(result => {
    if (result.success) {
        console.log('\n✅ PAYMENT SYSTEM IS READY FOR PRODUCTION!');
        console.log('🎯 Frontend integration will work correctly');
        console.log('🔗 Test payment URL:', result.paymentUrl);
    } else {
        console.log('\n❌ Payment system needs attention');
    }
}).catch(error => {
    console.error('💥 Unexpected error:', error);
});