const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { createAuditLog } = require('../utils/auditLogger');
const auth = require('../middleware/auth'); // Import auth middleware
const CreditPackage = require('../models/CreditPackage');
const Payment = require('../models/Payment'); // Import Payment model for webhook

// POST /api/payment/create - Create a new payment for a subscription plan
router.post('/create', auth, async (req, res) => {
    try {
        const { planId } = req.body;
        const userId = req.user.id;

        if (!planId) {
            return res.status(400).json({
                success: false,
                error: 'planId is required'
            });
        }
        
        const plan = await CreditPackage.findOne({ planId: planId, isActive: true });
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'Plan not found or is not active'
            });
        }

        const metadata = {
            ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer,
            userId: userId, // Pass userId to the service layer
            planId: plan.planId
        };

        const result = await paymentService.createSubscriptionPayment(userId, plan, metadata);

        await createAuditLog('PAYMENT_CREATED', `Payment created for user ${userId} for plan ${plan.name}`);

        return res.json({
            success: true,
            payUrl: result.payUrl,
            qrData: result.qrData,
            transferInfo: result.transferInfo,
            paymentId: result.payment._id,
            expiredAt: result.payment.expiredAt
        });

    } catch (error) {
        console.error('❌ Payment creation error:', error);
        let statusCode = 500;
        let errorMessage = 'Internal server error';

        if (error.message.includes('Invalid') || error.message.includes('required')) {
            statusCode = 400;
            errorMessage = error.message;
        } else if (error.message.includes('not found')) {
            statusCode = 404;
            errorMessage = error.message;
        }

        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: error.message
        });
    }
});

// POST /api/payment/complete/:paymentId - Hoàn thành payment (manual verification)
router.post('/complete/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { transactionId } = req.body;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                error: 'Payment ID is required'
            });
        }

        const result = await paymentService.completePayment(paymentId, transactionId);

        await createAuditLog('PAYMENT_COMPLETED', `Payment ${paymentId} completed. Credits added: ${result.payment.creditAmount}`);

        return res.json({
            success: true,
            message: 'Payment completed successfully',
            newCreditBalance: result.newCreditBalance,
            payment: result.payment
        });

    } catch (error) {
        console.error('Payment completion error:', error);
        
        let statusCode = 500;
        let errorMessage = 'Internal server error';

        if (error.message.includes('not found')) {
            statusCode = 404;
            errorMessage = error.message;
        } else if (error.message.includes('not in pending') || error.message.includes('expired')) {
            statusCode = 400;
            errorMessage = error.message;
        }

        return res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

// GET /api/payment/status/:paymentId - Kiểm tra trạng thái payment
router.get('/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                error: 'Payment ID is required'
            });
        }

        const result = await paymentService.getPaymentStatus(paymentId);

        return res.json({
            success: true,
            payment: result.payment,
            isExpired: result.isExpired
        });

    } catch (error) {
        console.error('Get payment status error:', error);
        
        let statusCode = 500;
        let errorMessage = 'Internal server error';

        if (error.message.includes('not found')) {
            statusCode = 404;
            errorMessage = error.message;
        }

        return res.status(statusCode).json({
            success: false,
            error: errorMessage
        });
    }
});

// GET /api/payment/user/:userKey - Lấy danh sách payment của user
router.get('/user/:userKey', async (req, res) => {
    try {
        const { userKey } = req.params;
        const { limit } = req.query;

        if (!userKey) {
            return res.status(400).json({
                success: false,
                error: 'User key is required'
            });
        }

        const result = await paymentService.getUserPayments(userKey, parseInt(limit) || 10);

        return res.json({
            success: true,
            payments: result.payments
        });

    } catch (error) {
        console.error('Get user payments error:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/payment/check-payos/:orderCode - Kiểm tra trạng thái thanh toán PayOS
router.post('/check-payos/:orderCode', async (req, res) => {
    try {
        const { orderCode } = req.params;

        if (!orderCode) {
            return res.status(400).json({
                success: false,
                error: 'Order code is required'
            });
        }

        const result = await paymentService.checkPayOSPaymentStatus(orderCode);

        if (result.success && result.status === 'PAID') {
            // Tự động hoàn thành payment nếu đã thanh toán
            const payment = await Payment.findOne({ 'paymentData.orderCode': parseInt(orderCode) });
            if (payment && payment.status === 'pending') {
                await paymentService.completePayment(payment._id, result.data.transactions?.[0]?.reference || `PAYOS_${orderCode}`);
                await createAuditLog('PAYMENT_AUTO_COMPLETED', `PayOS payment ${orderCode} auto completed`);
            }
        }

        return res.json({
            success: true,
            payosStatus: result.status,
            payosData: result.data || null,
            error: result.error || null
        });

    } catch (error) {
        console.error('Check PayOS payment error:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/payment/setup-webhook - Setup PayOS webhook URL
router.post('/setup-webhook', async (req, res) => {
    try {
        const webhookUrl = 'https://aistory-backend.onrender.com/api/payment/webhook/payos';
        const result = await paymentService.setupWebhook(webhookUrl);
        
        return res.json({
            success: true,
            message: 'Webhook setup initiated',
            result
        });

    } catch (error) {
        console.error('Setup webhook error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to setup webhook'
        });
    }
});

// POST /api/payment/webhook/payos - Webhook cho PayOS
router.post('/webhook/payos', async (req, res) => {
    try {
        const webhookData = req.body;
        const requestId = req.headers['x-request-id'] || `REQ_${Date.now()}`;
        
        console.log(`🔗 PayOS webhook received [${requestId}]:`, JSON.stringify(webhookData, null, 2));

        // Validate webhook data structure
        if (!webhookData || !webhookData.data) {
            console.error(`❌ Invalid webhook data structure [${requestId}]:`, webhookData);
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid webhook data structure',
                requestId 
            });
        }
        
        const { code, data } = webhookData;
        
        if (code === '00' && data.status === 'PAID') {
            const orderCode = data.orderCode;
            console.log(`💰 Processing PAID payment [${requestId}] for order: ${orderCode}`);
            
            // Tìm payment tương ứng
            const payment = await Payment.findOne({ 'paymentData.orderCode': orderCode });
            
            if (!payment) {
                console.warn(`⚠️ Payment not found [${requestId}] for orderCode: ${orderCode}`);
                return res.json({ 
                    success: true, 
                    message: 'Payment not found but webhook acknowledged',
                    requestId 
                });
            }
            
            console.log(`📝 Found payment [${requestId}]:`, {
                paymentId: payment._id,
                status: payment.status,
                userId: payment.userId,
                amount: payment.price
            });
            
            if (payment.status === 'pending') {
                console.log(`🔄 Completing payment [${requestId}]: ${payment._id}`);
                
                // Tự động hoàn thành payment
                const transactionRef = data.transactions?.[0]?.reference || `PAYOS_WEBHOOK_${orderCode}`;
                const completionResult = await paymentService.completePayment(payment._id, transactionRef);
                
                await createAuditLog('PAYMENT_WEBHOOK_COMPLETED', `PayOS webhook completed payment ${payment._id} [${requestId}]`);
                
                console.log(`✅ PayOS webhook [${requestId}]: Payment ${payment._id} completed automatically`);
                
                // NEW: Trigger frontend notification mechanism
                // Store completion flag with expiry for frontend to check
                global.completedPayments = global.completedPayments || new Map();
                global.completedPayments.set(payment._id.toString(), {
                    completedAt: new Date(),
                    userId: payment.userId,
                    planId: payment.planId,
                    transactionRef
                });
                
                // Auto cleanup after 5 minutes
                setTimeout(() => {
                    if (global.completedPayments) {
                        global.completedPayments.delete(payment._id.toString());
                    }
                }, 5 * 60 * 1000);
                
                console.log(`📢 Payment completion notification stored for frontend: ${payment._id}`);
                
                return res.json({ 
                    success: true, 
                    message: 'Payment completed successfully',
                    paymentId: payment._id,
                    requestId 
                });
            } else {
                console.log(`ℹ️ Payment already processed [${requestId}]: ${payment._id} (status: ${payment.status})`);
                return res.json({ 
                    success: true, 
                    message: 'Payment already processed',
                    requestId 
                });
            }
        } else {
            console.log(`ℹ️ Webhook not for PAID status [${requestId}]:`, { code, status: data.status });
            return res.json({ 
                success: true, 
                message: 'Webhook acknowledged but not PAID status',
                requestId 
            });
        }

    } catch (error) {
        const requestId = req.headers['x-request-id'] || `REQ_${Date.now()}`;
        console.error(`❌ PayOS webhook error [${requestId}]:`, error);
        console.error(`❌ Error details [${requestId}]:`, {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        
        return res.status(500).json({ 
            success: false, 
            error: 'Webhook processing failed',
            details: error.message,
            requestId 
        });
    }
});

// GET /api/payment/packages - Lấy danh sách gói credit
router.get('/packages', async (req, res) => {
    try {
        const CreditPackage = require('../models/CreditPackage');
        
        // Lấy tất cả gói credit đang active
        const packages = await CreditPackage.find({ isActive: { $ne: false } }).sort({ price: 1 });

        return res.json({
            success: true,
            packages: packages.map(pkg => ({
                _id: pkg._id,
                name: pkg.name,
                price: pkg.price,
                credits: pkg.credits,
                bonus: pkg.bonus,
                isPopular: pkg.isPopular,
                isActive: pkg.isActive
            }))
        });

    } catch (error) {
        console.error('Get packages error:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Unable to fetch credit packages'
        });
    }
});

// POST /api/payment/init-packages - Khởi tạo gói credit mặc định (admin only)
router.post('/init-packages', async (req, res) => {
    try {
        const { initCreditPackages } = require('../scripts/initCreditPackages');
        
        const packages = await initCreditPackages();

        await createAuditLog('CREDIT_PACKAGES_INIT', `Initialized ${packages.length} credit packages`);

        return res.json({
            success: true,
            message: `Initialized ${packages.length} credit packages successfully`,
            packages: packages.map(pkg => ({
                name: pkg.name,
                price: pkg.price,
                credits: pkg.credits,
                bonus: pkg.bonus
            }))
        });

    } catch (error) {
        console.error('Init packages error:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Failed to initialize credit packages'
        });
    }
});

// POST /api/payment/add-daily-packages - Add daily trial packages
router.post('/add-daily-packages', async (req, res) => {
    try {
        const CreditPackage = require('../models/CreditPackage');
        
        console.log('📦 Adding daily trial packages...');
        
        // Define daily trial packages
        const dailyPackages = [
            {
                planId: 'trial_3days',
                name: 'Gói Dùng Thử 3 Ngày',
                description: 'Trải nghiệm đầy đủ tính năng trong 3 ngày',
                price: 49000,
                durationType: 'days',
                durationValue: 3,
                durationMonths: null,
                isPopular: false,
                isActive: true
            },
            {
                planId: 'trial_5days',
                name: 'Gói Dùng Thử 5 Ngày', 
                description: 'Trải nghiệm đầy đủ tính năng trong 5 ngày',
                price: 69000,
                durationType: 'days',
                durationValue: 5,
                durationMonths: null,
                isPopular: false,
                isActive: true
            },
            {
                planId: 'trial_7days',
                name: 'Gói Dùng Thử 1 Tuần',
                description: 'Trải nghiệm đầy đủ tính năng trong 7 ngày',
                price: 99000,
                durationType: 'days',
                durationValue: 7,
                durationMonths: null,
                isPopular: true,
                isActive: true
            }
        ];
        
        const createdPackages = [];
        
        for (const packageData of dailyPackages) {
            // Check if package already exists
            const existingPackage = await CreditPackage.findOne({ planId: packageData.planId });
            
            if (existingPackage) {
                console.log(`⚠️ Package ${packageData.planId} already exists, skipping`);
                continue;
            }
            
            // Create new package
            const newPackage = new CreditPackage(packageData);
            await newPackage.save();
            
            console.log(`✅ Created package: ${newPackage.name}`);
            createdPackages.push(newPackage);
        }
        
        // Update existing packages to use new duration system
        console.log('🔄 Updating existing packages for compatibility...');
        
        const existingPackages = await CreditPackage.find({ 
            $or: [
                { durationType: { $exists: false } },
                { durationValue: { $exists: false } }
            ]
        });
        
        for (const pkg of existingPackages) {
            if (!pkg.durationType) {
                pkg.durationType = 'months';
            }
            if (!pkg.durationValue && pkg.durationMonths) {
                pkg.durationValue = pkg.durationMonths;
            }
            await pkg.save();
            console.log(`✅ Updated compatibility for: ${pkg.name}`);
        }
        
        await createAuditLog('DAILY_PACKAGES_ADDED', `Added ${createdPackages.length} daily trial packages`);
        
        return res.json({
            success: true,
            message: `Added ${createdPackages.length} daily trial packages successfully`,
            packages: createdPackages.map(pkg => ({
                planId: pkg.planId,
                name: pkg.name,
                price: pkg.price,
                durationType: pkg.durationType,
                durationValue: pkg.durationValue
            }))
        });
        
    } catch (error) {
        console.error('Add daily packages error:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Failed to add daily trial packages',
            details: error.message
        });
    }
});

// POST /api/payment/cleanup - Cleanup expired payments (admin only)
router.post('/cleanup', async (req, res) => {
    try {
        const result = await paymentService.cleanupExpiredPayments();

        await createAuditLog('PAYMENT_CLEANUP', `Cleaned up ${result.modifiedCount} expired payments`);

        return res.json({
            success: true,
            message: `Cleaned up ${result.modifiedCount} expired payments`,
            result
        });

    } catch (error) {
        console.error('Payment cleanup error:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// POST /api/payment/force-complete/:userKey - Force complete recent payment for debugging
router.post('/force-complete/:userKey', async (req, res) => {
    try {
        const { userKey } = req.params;
        const Payment = require('../models/Payment');
        
        console.log('🔧 Force completing payment for user:', userKey.substring(0, 10) + '...');
        
        // Find most recent pending payment for this user
        const payment = await Payment.findOne({ 
            userKey, 
            status: 'pending' 
        }).sort({ createdAt: -1 });
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'No pending payment found for this user'
            });
        }
        
        console.log('📝 Found payment to complete:', payment._id);
        
        // Force complete the payment
        const result = await paymentService.completePayment(payment._id, `MANUAL_FORCE_${Date.now()}`);
        
        await createAuditLog('PAYMENT_FORCE_COMPLETED', `Manually force completed payment ${payment._id} for user ${userKey.substring(0, 10)}...`);
        
        return res.json({
            success: true,
            message: 'Payment force completed successfully',
            payment: result.payment,
            newCreditBalance: result.newCreditBalance
        });
        
    } catch (error) {
        console.error('Force complete payment error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// GET /api/payment/debug/:paymentId - Debug payment and webhook status
router.get('/debug/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const Payment = require('../models/Payment');
        const User = require('../models/User');
        
        console.log('🔍 Debugging payment:', paymentId);
        
        // Get payment details
        const payment = await Payment.findById(paymentId).populate('userId');
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }
        
        // Get user details
        const user = await User.findById(payment.userId);
        
        // Check PayOS status if orderCode exists
        let payosStatus = null;
        if (payment.paymentData?.orderCode) {
            try {
                payosStatus = await paymentService.checkPayOSPaymentStatus(payment.paymentData.orderCode);
            } catch (error) {
                console.warn('Failed to check PayOS status:', error.message);
                payosStatus = { error: error.message };
            }
        }
        
        return res.json({
            success: true,
            debug: {
                payment: {
                    id: payment._id,
                    status: payment.status,
                    price: payment.price,
                    orderCode: payment.paymentData?.orderCode,
                    createdAt: payment.createdAt,
                    expiredAt: payment.expiredAt,
                    completedAt: payment.completedAt,
                    transactionId: payment.transactionId
                },
                user: user ? {
                    id: user._id,
                    email: user.email,
                    subscriptionType: user.subscriptionType,
                    subscriptionExpiresAt: user.subscriptionExpiresAt,
                    isActive: user.isActive
                } : null,
                payosStatus: payosStatus,
                recommendations: generateDebugRecommendations(payment, user, payosStatus)
            }
        });
        
    } catch (error) {
        console.error('Debug payment error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
});

// Helper function to generate debug recommendations
function generateDebugRecommendations(payment, user, payosStatus) {
    const recommendations = [];
    
    if (payment.status === 'pending' && payosStatus?.payosStatus === 'PAID') {
        recommendations.push('Payment is PAID on PayOS but still pending in database. Try force completing it.');
    }
    
    if (payment.status === 'completed' && (!user.subscriptionType || user.subscriptionType === 'free')) {
        recommendations.push('Payment is completed but user subscription was not updated. Check subscription logic.');
    }
    
    if (payment.status === 'pending' && new Date() > new Date(payment.expiredAt)) {
        recommendations.push('Payment has expired. User may need to create a new payment.');
    }
    
    if (payosStatus?.error) {
        recommendations.push(`PayOS check failed: ${payosStatus.error}. Webhook may not be working.`);
    }
    
    return recommendations;
}

// GET /api/payment/check-completion/:paymentId - Check if payment was completed via webhook
router.get('/check-completion/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        // Check if payment completion notification exists
        if (global.completedPayments && global.completedPayments.has(paymentId)) {
            const completionInfo = global.completedPayments.get(paymentId);
            console.log(`✅ Frontend checking completion for ${paymentId}: FOUND`);
            
            // Remove notification after frontend checks (one-time use)
            global.completedPayments.delete(paymentId);
            
            return res.json({
                success: true,
                completed: true,
                completionInfo
            });
        }
        
        // Also check database status as fallback
        const payment = await Payment.findById(paymentId);
        if (payment && payment.status === 'completed') {
            console.log(`✅ Frontend checking completion for ${paymentId}: Database shows completed`);
            return res.json({
                success: true,
                completed: true,
                completionInfo: {
                    completedAt: payment.completedAt || payment.updatedAt,
                    userId: payment.userId,
                    planId: payment.planId
                }
            });
        }
        
        console.log(`⏳ Frontend checking completion for ${paymentId}: Still pending`);
        return res.json({
            success: true,
            completed: false
        });
        
    } catch (error) {
        console.error('❌ Error checking payment completion:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check payment completion'
        });
    }
});

module.exports = router;