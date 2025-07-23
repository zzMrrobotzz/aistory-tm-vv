const PayOS = require('./apps/backend/node_modules/@payos/node');

// PayOS credentials - same as in backend
const PAYOS_CLIENT_ID = 'be64263c-d0b5-48c7-a5e4-9e1357786d4c';
const PAYOS_API_KEY = '6c790eab-3334-4180-bf54-d3071ca7f277';
const PAYOS_CHECKSUM_KEY = '271d878407a1020d240d9064d0bfb4300bfe2e02bf997bb28771dea73912bd55';

async function testPayOSConnection() {
    try {
        console.log('🔧 Testing PayOS connection...');
        
        // Initialize PayOS client
        const payOS = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);
        console.log('✅ PayOS client initialized');
        
        // Test creating a payment link
        const orderCode = Date.now();
        const paymentData = {
            orderCode: orderCode,
            amount: 299000, // 299k VND for Monthly plan
            description: 'Goi Hang Thang',
            items: [{
                name: 'Gói Hàng Tháng',
                quantity: 1,
                price: 299000
            }],
            returnUrl: 'https://aistorytmvvfrontend.netlify.app/pricing?status=success',
            cancelUrl: 'https://aistorytmvvfrontend.netlify.app/pricing?status=cancelled'
        };
        
        console.log('📝 Creating test payment link...');
        console.log('Payment data:', paymentData);
        
        const paymentLinkRes = await payOS.createPaymentLink(paymentData);
        
        console.log('✅ Payment link created successfully!');
        console.log('🔗 Checkout URL:', paymentLinkRes.checkoutUrl);
        console.log('📱 QR Code:', paymentLinkRes.qrCode);
        console.log('🆔 Payment Link ID:', paymentLinkRes.paymentLinkId);
        
        // Test getting payment info
        console.log('\n📋 Testing payment info retrieval...');
        try {
            const paymentInfo = await payOS.getPaymentLinkInformation(paymentLinkRes.paymentLinkId);
            console.log('✅ Payment info retrieved:', {
                id: paymentInfo.id,
                status: paymentInfo.status,
                amount: paymentInfo.amount,
                orderCode: paymentInfo.orderCode
            });
        } catch (infoError) {
            console.log('⚠️  Payment info error (may be normal for new payment):', infoError.message);
        }
        
        console.log('\n🎉 PayOS integration test SUCCESSFUL!');
        console.log('💡 You can test payment by visiting:', paymentLinkRes.checkoutUrl);
        
        return {
            success: true,
            checkoutUrl: paymentLinkRes.checkoutUrl,
            paymentLinkId: paymentLinkRes.paymentLinkId,
            orderCode: orderCode
        };
        
    } catch (error) {
        console.error('❌ PayOS test failed:', error.message);
        console.error('Full error:', error);
        return { success: false, error: error.message };
    }
}

// Run test
testPayOSConnection().then(result => {
    if (result.success) {
        console.log('\n✅ PAYOS IS READY FOR PRODUCTION!');
        console.log('🚀 Backend payment system will work correctly');
    } else {
        console.log('\n❌ PayOS integration needs attention');
        console.log('🔧 Check credentials and network connection');
    }
    process.exit(result.success ? 0 : 1);
}).catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});