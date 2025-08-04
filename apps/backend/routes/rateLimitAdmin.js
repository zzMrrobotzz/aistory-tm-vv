const express = require('express');
const router = express.Router();
const RateLimitConfig = require('../models/RateLimitConfig');
const DailyUsageLimit = require('../models/DailyUsageLimit');
const { getUserUsageStatus, detectPotentialSharing, resetDailyUsage } = require('../middleware/dynamicRateLimit');

// @route   GET /api/admin/rate-limit/config
// @desc    Get current rate limit configuration
// @access  Admin
router.get('/config', async (req, res) => {
    try {
        const config = await RateLimitConfig.getDefault();
        
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error('Error fetching rate limit config:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải cấu hình rate limit',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/rate-limit/config
// @desc    Update rate limit configuration
// @access  Admin
router.put('/config', async (req, res) => {
    try {
        const updateData = req.body;
        
        // Add metadata
        updateData.lastUpdatedBy = req.user?.username || 'admin';
        updateData.version = (updateData.version || 0) + 1;
        
        let config = await RateLimitConfig.findOne({ isActive: true });
        
        if (!config) {
            config = new RateLimitConfig(updateData);
        } else {
            Object.assign(config, updateData);
        }
        
        await config.save();
        
        res.json({
            success: true,
            message: 'Cấu hình rate limit đã được cập nhật',
            data: config
        });
    } catch (error) {
        console.error('Error updating rate limit config:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật cấu hình rate limit',
            error: error.message
        });
    }
});

// @route   GET /api/admin/rate-limit/stats
// @desc    Get usage statistics
// @access  Admin
router.get('/stats', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const stats = await DailyUsageLimit.getUsageStats(startDateStr, endDate);
        
        // Get current day stats
        const today = new Date().toISOString().split('T')[0];
        const todayStats = await DailyUsageLimit.aggregate([
            { $match: { date: today } },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    activeUsers: { $sum: { $cond: [{ $gt: ['$totalUsage', 0] }, 1, 0] } },
                    totalUsage: { $sum: '$totalUsage' },
                    avgUsage: { $avg: '$totalUsage' },
                    blockedUsers: { $sum: { $cond: ['$isBlocked', 1, 0] } },
                    heavyUsers: { 
                        $sum: { 
                            $cond: [
                                { $gte: [{ $divide: ['$totalUsage', '$dailyLimit'] }, 0.8] }, 
                                1, 
                                0
                            ] 
                        } 
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                historical: stats,
                today: todayStats[0] || {
                    totalUsers: 0,
                    activeUsers: 0,
                    totalUsage: 0,
                    avgUsage: 0,
                    blockedUsers: 0,
                    heavyUsers: 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching rate limit stats:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải thống kê',
            error: error.message
        });
    }
});

// @route   GET /api/admin/rate-limit/heavy-users
// @desc    Get users with high usage (potential account sharers)
// @access  Admin
router.get('/heavy-users', async (req, res) => {
    try {
        const { days = 7, threshold = 0.85 } = req.query;
        
        const heavyUsers = await detectPotentialSharing(parseInt(days));
        
        res.json({
            success: true,
            data: heavyUsers,
            meta: {
                days: parseInt(days),
                threshold: parseFloat(threshold),
                count: heavyUsers.length
            }
        });
    } catch (error) {
        console.error('Error fetching heavy users:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải danh sách heavy users',
            error: error.message
        });
    }
});

// @route   GET /api/admin/rate-limit/user-usage/:userId
// @desc    Get detailed usage for specific user
// @access  Admin
router.get('/user-usage/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { days = 7 } = req.query;
        
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const userUsage = await DailyUsageLimit.find({
            userId,
            date: { $gte: startDateStr, $lte: endDate }
        }).sort({ date: -1 });
        
        const currentStatus = await getUserUsageStatus(userId);
        
        res.json({
            success: true,
            data: {
                currentStatus,
                history: userUsage
            }
        });
    } catch (error) {
        console.error('Error fetching user usage:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải usage của user',
            error: error.message
        });
    }
});

// @route   POST /api/admin/rate-limit/block-user
// @desc    Block/unblock user
// @access  Admin
router.post('/block-user', async (req, res) => {
    try {
        const { userId, isBlocked, blockReason } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID là bắt buộc'
            });
        }
        
        const today = new Date().toISOString().split('T')[0];
        const dailyUsage = await DailyUsageLimit.findOne({ userId, date: today });
        
        if (!dailyUsage) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy usage record cho user này'
            });
        }
        
        dailyUsage.isBlocked = isBlocked;
        dailyUsage.blockReason = isBlocked ? blockReason : null;
        dailyUsage.blockedAt = isBlocked ? new Date() : null;
        
        await dailyUsage.save();
        
        res.json({
            success: true,
            message: isBlocked ? 'User đã bị khóa' : 'User đã được mở khóa',
            data: {
                userId,
                isBlocked,
                blockReason,
                blockedAt: dailyUsage.blockedAt
            }
        });
    } catch (error) {
        console.error('Error blocking/unblocking user:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể thay đổi trạng thái block của user',
            error: error.message
        });
    }
});

// @route   POST /api/admin/rate-limit/reset-user-usage
// @desc    Reset usage for specific user
// @access  Admin
router.post('/reset-user-usage', async (req, res) => {
    try {
        const { userId, date } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID là bắt buộc'
            });
        }
        
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const dailyUsage = await DailyUsageLimit.findOne({ userId, date: targetDate });
        
        if (!dailyUsage) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy usage record'
            });
        }
        
        // Reset usage
        dailyUsage.totalUsage = 0;
        dailyUsage.moduleUsage = [];
        dailyUsage.requestHistory = [];
        dailyUsage.warningsIssued = [];
        dailyUsage.isBlocked = false;
        dailyUsage.blockReason = null;
        dailyUsage.blockedAt = null;
        
        await dailyUsage.save();
        
        res.json({
            success: true,
            message: 'Usage của user đã được reset',
            data: dailyUsage
        });
    } catch (error) {
        console.error('Error resetting user usage:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể reset usage của user',
            error: error.message
        });
    }
});

// @route   POST /api/admin/rate-limit/exempt-user
// @desc    Add/remove user exemption
// @access  Admin
router.post('/exempt-user', async (req, res) => {
    try {
        const { userId, username, isExempt, exemptionReason } = req.body;
        
        if (!userId || !username) {
            return res.status(400).json({
                success: false,
                message: 'User ID và username là bắt buộc'
            });
        }
        
        const config = await RateLimitConfig.getDefault();
        
        if (isExempt) {
            // Add exemption
            const existingExemption = config.exemptedUsers.find(u => u.userId.toString() === userId);
            if (!existingExemption) {
                config.exemptedUsers.push({
                    userId,
                    username,
                    exemptionReason: exemptionReason || 'Admin exemption',
                    exemptedBy: req.user?.username || 'admin'
                });
            }
        } else {
            // Remove exemption
            config.exemptedUsers = config.exemptedUsers.filter(u => u.userId.toString() !== userId);
        }
        
        config.lastUpdatedBy = req.user?.username || 'admin';
        config.version += 1;
        
        await config.save();
        
        res.json({
            success: true,
            message: isExempt ? 'User đã được miễn rate limit' : 'User đã bị gỡ miễn rate limit',
            data: {
                userId,
                username,
                isExempt,
                exemptionReason
            }
        });
    } catch (error) {
        console.error('Error managing user exemption:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể thay đổi trạng thái miễn rate limit',
            error: error.message
        });
    }
});

// @route   GET /api/admin/rate-limit/module-stats
// @desc    Get statistics by module
// @access  Admin
router.get('/module-stats', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const moduleStats = await DailyUsageLimit.aggregate([
            { $match: { date: { $gte: startDateStr, $lte: endDate } } },
            { $unwind: '$moduleUsage' },
            {
                $group: {
                    _id: '$moduleUsage.moduleId',
                    moduleName: { $first: '$moduleUsage.moduleName' },
                    totalRequests: { $sum: '$moduleUsage.requestCount' },
                    totalWeightedUsage: { $sum: '$moduleUsage.weightedUsage' },
                    uniqueUsers: { $addToSet: '$userId' },
                    avgRequestsPerUser: { $avg: '$moduleUsage.requestCount' }
                }
            },
            {
                $project: {
                    moduleId: '$_id',
                    moduleName: 1,
                    totalRequests: 1,
                    totalWeightedUsage: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    avgRequestsPerUser: { $round: ['$avgRequestsPerUser', 2] }
                }
            },
            { $sort: { totalRequests: -1 } }
        ]);
        
        res.json({
            success: true,
            data: moduleStats,
            meta: {
                days: parseInt(days),
                period: `${startDateStr} to ${endDate}`
            }
        });
    } catch (error) {
        console.error('Error fetching module stats:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải thống kê module',
            error: error.message
        });
    }
});

// @route   POST /api/admin/rate-limit/cleanup
// @desc    Cleanup old usage records
// @access  Admin
router.post('/cleanup', async (req, res) => {
    try {
        const result = await resetDailyUsage();
        
        res.json({
            success: true,
            message: 'Cleanup hoàn tất',
            data: result
        });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cleanup',
            error: error.message
        });
    }
});

module.exports = router;