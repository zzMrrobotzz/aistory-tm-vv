const express = require('express');
const router = express.Router();
const { getUserUsageStatus } = require('../middleware/dynamicRateLimit');
const RateLimitConfig = require('../models/RateLimitConfig');
const DailyUsageLimit = require('../models/DailyUsageLimit');

// @route   GET /api/user/usage-status
// @desc    Get current user's usage status
// @access  Protected (requires auth)
router.get('/usage-status', async (req, res) => {
    try {
        // Support both token shapes: { _id } and { id }
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: missing user id in token'
            });
        }
        
        const usageStatus = await getUserUsageStatus(userId);
        const config = await RateLimitConfig.getDefault();
        
        if (!usageStatus) {
            return res.status(500).json({
                success: false,
                message: 'Không thể tải thông tin usage'
            });
        }
        
        // Get restricted modules info
        const restrictedModules = config.getActiveRestrictedModules();
        
        // Check for warnings
        const warningMessage = config.getWarningMessage(usageStatus.percentage);
        
        res.json({
            success: true,
            data: {
                usage: usageStatus,
                config: {
                    isEnabled: config.isEnabled,
                    dailyLimit: config.getEffectiveDailyLimit(req.user),
                    restrictedModules: restrictedModules.map(m => ({
                        id: m.moduleId,
                        name: m.moduleName,
                        weight: m.weight
                    })),
                    resetTime: config.resetTime,
                    timezone: config.timezone
                },
                warning: warningMessage ? {
                    message: warningMessage,
                    percentage: usageStatus.percentage
                } : null,
                recommendations: generateRecommendations(usageStatus, config)
            }
        });
    } catch (error) {
        console.error('Error fetching user usage status:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải thông tin usage',
            error: error.message
        });
    }
});

// @route   GET /api/user/usage-history
// @desc    Get user's usage history
// @access  Protected (requires auth)
router.get('/usage-history', async (req, res) => {
    try {
        // Support both token shapes: { _id } and { id }
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: missing user id in token'
            });
        }
        const { days = 7 } = req.query;
        
        const DailyUsageLimit = require('../models/DailyUsageLimit');
        
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const history = await DailyUsageLimit.find({
            userId,
            date: { $gte: startDateStr, $lte: endDate }
        }).sort({ date: -1 });
        
        // Calculate aggregated stats
        const stats = {
            totalDays: history.length,
            totalUsage: history.reduce((sum, day) => sum + day.totalUsage, 0),
            avgDailyUsage: history.length > 0 ? 
                Math.round(history.reduce((sum, day) => sum + day.totalUsage, 0) / history.length) : 0,
            daysExceededLimit: history.filter(day => day.totalUsage >= day.dailyLimit).length,
            mostUsedModule: getMostUsedModule(history)
        };
        
        res.json({
            success: true,
            data: {
                history: history.map(day => ({
                    date: day.date,
                    usage: day.totalUsage,
                    limit: day.dailyLimit,
                    percentage: day.getUsagePercentage(),
                    moduleUsage: day.moduleUsage,
                    isBlocked: day.isBlocked,
                    warningsIssued: day.warningsIssued
                })),
                stats
            },
            meta: {
                days: parseInt(days),
                period: `${startDateStr} to ${endDate}`
            }
        });
    } catch (error) {
        console.error('Error fetching user usage history:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải lịch sử usage',
            error: error.message
        });
    }
});

// @route   POST /api/user/record-usage
// @desc    Record usage for a module (called after successful API call)
// @access  Protected (requires auth)
router.post('/record-usage', async (req, res) => {
    try {
        console.log('record-usage called with body:', req.body);
        console.log('req.user:', req.user);
        
        // Support both token shapes: { _id } and { id }
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            console.error('No userId found in token');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: missing user id in token'
            });
        }
        
        console.log('Using userId:', userId);
        const { moduleId, moduleName } = req.body;
        
        if (!moduleId || !moduleName) {
            return res.status(400).json({
                success: false,
                message: 'moduleId và moduleName là bắt buộc'
            });
        }
        
        const config = await RateLimitConfig.getDefault();
        
        // Check if rate limiting is enabled
        if (!config.isEnabled) {
            return res.json({
                success: true,
                message: 'Rate limiting disabled, usage not recorded'
            });
        }
        
        // Check if module is restricted
        if (!config.isModuleRestricted(moduleId)) {
            return res.json({
                success: true,
                message: 'Module not restricted, usage not recorded'
            });
        }
        
        const userInfo = {
            username: req.user.username || req.user.email,
            email: req.user.email,
            subscriptionType: req.user.subscriptionType || 'free'
        };
        
        const effectiveDailyLimit = config.getEffectiveDailyLimit(req.user);
        const moduleWeight = config.getModuleWeight(moduleId);
        
        console.log('About to call getOrCreateDaily with:', { userId, userInfo, effectiveDailyLimit });
        
        // Get or create daily usage record
        const dailyUsage = await DailyUsageLimit.getOrCreateDaily(
            userId, 
            userInfo, 
            effectiveDailyLimit
        );
        
        console.log('DailyUsage created/found:', dailyUsage);
        
        // Record the usage
        const requestMetadata = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            requestId: req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        dailyUsage.addUsage(moduleId, moduleName, moduleWeight, requestMetadata);
        await dailyUsage.save();
        
        res.json({
            success: true,
            message: 'Usage recorded successfully',
            usage: {
                current: dailyUsage.totalUsage,
                limit: dailyUsage.dailyLimit,
                remaining: dailyUsage.getRemainingQuota(),
                percentage: dailyUsage.getUsagePercentage()
            }
        });
        
    } catch (error) {
        console.error('Error recording usage:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi ghi nhận usage',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Helper function to generate recommendations based on usage
function generateRecommendations(usageStatus, config) {
    const recommendations = [];
    
    if (usageStatus.percentage >= 90) {
        recommendations.push({
            type: 'warning',
            title: 'Gần hết quota',
            message: 'Bạn đã sử dụng gần hết quota hôm nay. Hãy cân nhắc nâng cấp gói hoặc sử dụng tiết kiệm.',
            actions: ['upgrade-subscription', 'use-other-modules']
        });
    } else if (usageStatus.percentage >= 75) {
        recommendations.push({
            type: 'info',
            title: 'Sử dụng cao',
            message: 'Bạn đang sử dụng khá nhiều quota. Theo dõi để tránh vượt giới hạn.',
            actions: ['monitor-usage']
        });
    }
    
    if (usageStatus.isBlocked) {
        recommendations.push({
            type: 'error',
            title: 'Tài khoản bị khóa',
            message: `Tài khoản của bạn đã bị tạm khóa: ${usageStatus.blockReason}`,
            actions: ['contact-support']
        });
    }
    
    // Check if user can benefit from subscription upgrade
    const userSubscription = usageStatus.subscriptionType || 'free';
    if (userSubscription === 'free' && usageStatus.percentage >= 60) {
        recommendations.push({
            type: 'upgrade',
            title: 'Nâng cấp gói dịch vụ',
            message: 'Với mức sử dụng hiện tại, bạn sẽ có lợi khi nâng cấp lên gói trả phí.',
            actions: ['view-pricing', 'upgrade-subscription']
        });
    }
    
    return recommendations;
}

// Helper function to find most used module
function getMostUsedModule(history) {
    const moduleStats = {};
    
    history.forEach(day => {
        day.moduleUsage.forEach(module => {
            if (!moduleStats[module.moduleId]) {
                moduleStats[module.moduleId] = {
                    id: module.moduleId,
                    name: module.moduleName,
                    totalRequests: 0,
                    totalWeightedUsage: 0
                };
            }
            moduleStats[module.moduleId].totalRequests += module.requestCount;
            moduleStats[module.moduleId].totalWeightedUsage += module.weightedUsage;
        });
    });
    
    const modules = Object.values(moduleStats);
    if (modules.length === 0) return null;
    
    return modules.reduce((max, current) => 
        current.totalRequests > max.totalRequests ? current : max
    );
}

module.exports = router;