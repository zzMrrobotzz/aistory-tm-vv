const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const User = require('../models/User');
const CreditPackage = require('../models/CreditPackage');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/admin/payments/stats - Thống kê payment dashboard
router.get('/stats', async (req, res) => {
    try {
        console.log('📊 Loading admin payment stats...');
        
        // Tổng quan payments
        const totalPayments = await Payment.countDocuments();
        const completedPayments = await Payment.countDocuments({ status: 'completed' });
        const pendingPayments = await Payment.countDocuments({ status: 'pending' });
        const failedPayments = await Payment.countDocuments({ status: 'failed' });
        const expiredPayments = await Payment.countDocuments({ status: 'expired' });
        
        // Tổng doanh thu
        const totalRevenueResult = await Payment.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);
        const totalRevenue = totalRevenueResult[0]?.total || 0;
        
        // Doanh thu tháng này
        const thisMonthStart = new Date();
        thisMonthStart.setDate(1);
        thisMonthStart.setHours(0, 0, 0, 0);
        
        const monthlyRevenueResult = await Payment.aggregate([
            { 
                $match: { 
                    status: 'completed',
                    completedAt: { $gte: thisMonthStart }
                } 
            },
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);
        const revenueThisMonth = monthlyRevenueResult[0]?.total || 0;
        
        // Số giao dịch tháng này
        const paymentsThisMonth = await Payment.countDocuments({
            status: 'completed',
            completedAt: { $gte: thisMonthStart }
        });
        
        // Top planIds theo doanh thu
        const topPlanIds = await Payment.aggregate([
            { $match: { status: 'completed', planId: { $exists: true, $ne: null } } },
            { 
                $group: { 
                    _id: '$planId', 
                    count: { $sum: 1 },
                    revenue: { $sum: '$price' }
                } 
            },
            { $sort: { revenue: -1 } },
            { $limit: 5 },
            { 
                $project: { 
                    planId: '$_id',
                    count: 1,
                    revenue: 1,
                    _id: 0
                }
            }
        ]);
        
        // Recent payments (5 gần nhất)
        const recentPayments = await Payment.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('_id userId userKey planId price status createdAt completedAt paymentMethod');
        
        const stats = {
            totalRevenue,
            totalPayments,
            completedPayments,
            pendingPayments,
            failedPayments,
            expiredPayments,
            revenueThisMonth,
            paymentsThisMonth,
            topPlanIds,
            recentPayments
        };
        
        console.log('✅ Admin payment stats loaded:', { 
            totalRevenue, 
            totalPayments, 
            completedPayments, 
            revenueThisMonth 
        });
        
        res.json({
            success: true,
            ...stats
        });
        
    } catch (error) {
        console.error('❌ Error loading admin payment stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load payment statistics'
        });
    }
});

// GET /api/admin/payments - Danh sách payments với filter và pagination
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            status = 'all',
            paymentMethod = 'all',
            startDate,
            endDate
        } = req.query;
        
        console.log(`📋 Loading payments list - Page: ${page}, Limit: ${limit}, Status: ${status}`);
        
        // Build query filter
        const filter = {};
        
        // Search filter
        if (search) {
            filter.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { userId: { $regex: search, $options: 'i' } },
                { userKey: { $regex: search, $options: 'i' } },
                { planId: { $regex: search, $options: 'i' } },
                { transactionId: { $regex: search, $options: 'i' } }
            ];
        }
        
        // Status filter
        if (status !== 'all') {
            filter.status = status;
        }
        
        // Payment method filter
        if (paymentMethod !== 'all') {
            filter.paymentMethod = paymentMethod;
        }
        
        // Date range filter
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = endDateTime;
            }
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get payments với pagination
        const payments = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        // Get total count cho pagination
        const total = await Payment.countDocuments(filter);
        
        res.json({
            success: true,
            payments,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('❌ Error loading payments list:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load payments list'
        });
    }
});

// GET /api/admin/payments/:paymentId - Chi tiết payment
router.get('/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        console.log(`📄 Loading payment details: ${paymentId}`);
        
        const payment = await Payment.findById(paymentId).lean();
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }
        
        // Thêm thông tin user nếu có
        let userInfo = null;
        if (payment.userId) {
            const user = await User.findById(payment.userId)
                .select('username email registeredAt isActive')
                .lean();
            userInfo = user;
        }
        
        // Thêm thông tin package nếu có
        let packageInfo = null;
        if (payment.planId) {
            const pkg = await CreditPackage.findOne({ planId: payment.planId })
                .select('name description price durationType durationValue')
                .lean();
            packageInfo = pkg;
        }
        
        res.json({
            success: true,
            ...payment,
            userInfo,
            packageInfo
        });
        
    } catch (error) {
        console.error('❌ Error loading payment details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load payment details'
        });
    }
});

// POST /api/admin/payments/:paymentId/complete - Admin hoàn thành payment thủ công
router.post('/:paymentId/complete', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { transactionId, notes } = req.body;
        
        console.log(`💳 Admin manually completing payment: ${paymentId}`);
        
        const payment = await Payment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }
        
        if (payment.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Payment is already ${payment.status}`
            });
        }
        
        // Complete payment
        const paymentService = require('../services/paymentService');
        const result = await paymentService.completePayment(
            paymentId, 
            transactionId || `ADMIN_MANUAL_${Date.now()}`
        );
        
        // Log audit
        await createAuditLog(
            'ADMIN_PAYMENT_COMPLETED', 
            `Admin manually completed payment ${paymentId}${notes ? ` - Notes: ${notes}` : ''}`
        );
        
        res.json({
            success: true,
            message: 'Payment completed successfully',
            payment: result.payment,
            newCreditBalance: result.newCreditBalance
        });
        
    } catch (error) {
        console.error('❌ Error completing payment:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to complete payment'
        });
    }
});

// POST /api/admin/payments/:paymentId/refund - Hoàn tiền (đánh dấu refunded)
router.post('/:paymentId/refund', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { reason, refundAmount } = req.body;
        
        console.log(`💰 Processing refund for payment: ${paymentId}`);
        
        const payment = await Payment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found'
            });
        }
        
        if (payment.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Can only refund completed payments'
            });
        }
        
        // Update payment status và thêm refund info
        payment.status = 'refunded';
        payment.refundInfo = {
            reason: reason || 'Admin refund',
            refundAmount: refundAmount || payment.price,
            refundedAt: new Date(),
            refundedBy: 'admin'
        };
        
        await payment.save();
        
        // TODO: Implement actual refund logic với payment gateway
        // TODO: Trừ credits/subscription từ user nếu cần
        
        await createAuditLog(
            'ADMIN_PAYMENT_REFUNDED', 
            `Admin refunded payment ${paymentId} - Amount: ${refundAmount || payment.price} - Reason: ${reason || 'No reason provided'}`
        );
        
        res.json({
            success: true,
            message: 'Payment refunded successfully',
            payment
        });
        
    } catch (error) {
        console.error('❌ Error processing refund:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process refund'
        });
    }
});

// GET /api/admin/payments/analytics/daily - Daily revenue analytics
router.get('/analytics/daily', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        
        console.log(`📈 Loading daily revenue analytics for ${days} days`);
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        startDate.setHours(0, 0, 0, 0);
        
        const dailyStats = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    completedAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$completedAt' },
                        month: { $month: '$completedAt' },
                        day: { $dayOfMonth: '$completedAt' }
                    },
                    revenue: { $sum: '$price' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            },
            {
                $project: {
                    date: {
                        $dateFromParts: {
                            year: '$_id.year',
                            month: '$_id.month',
                            day: '$_id.day'
                        }
                    },
                    revenue: 1,
                    count: 1,
                    _id: 0
                }
            }
        ]);
        
        res.json({
            success: true,
            dailyStats
        });
        
    } catch (error) {
        console.error('❌ Error loading daily analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load daily analytics'
        });
    }
});

module.exports = router;
