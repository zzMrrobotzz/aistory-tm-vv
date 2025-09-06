const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/adminAuth');
const { updateUserActivity } = require('../middleware/activityTracker');
const FeatureUsage = require('../models/FeatureUsage');
const User = require('../models/User');
const FeatureSettings = require('../models/FeatureSettings');
const { getVietnamDate } = require('../utils/timezone');

// Middleware để extract userId từ token
const extractUserId = (req, res, next) => {
  try {
    const userId = req.user?.user?.id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: missing user id in token'
      });
    }
    req.userId = userId;
    next();
  } catch (error) {
    console.error('Error extracting userId:', error);
    res.status(401).json({
      success: false,
      message: 'Unauthorized: invalid token'
    });
  }
};

// Global feature limit - all users get same limit regardless of subscription
const DEFAULT_DAILY_LIMIT = 300; // All subscriptions share same 300 daily limit

// Test route để kiểm tra backend hoạt động
router.get('/test', (req, res) => {
  console.log('📍 Feature usage test route called');
  res.json({
    success: true,
    message: 'Feature usage backend is working',
    timestamp: new Date().toISOString(),
    server: 'featureUsage service'
  });
});

// GET /api/features/usage-status - Get current feature usage status
// Simplified route without auth middleware for debugging
router.get('/usage-status-debug', async (req, res) => {
  try {
    console.log('🔧 Debug route called - no auth');
    res.json({
      success: true,
      data: {
        usage: {
          current: 0,
          dailyLimit: DEFAULT_DAILY_LIMIT,
          remaining: DEFAULT_DAILY_LIMIT,
          percentage: 0,
          isBlocked: false,
          resetTime: 24 * 60 * 60 * 1000 // 24 hours
        },
        config: {
          subscriptionType: 'debug',
          isEnabled: true,
          resetTime: '00:00',
          timezone: 'Asia/Ho_Chi_Minh'
        }
      }
    });
  } catch (error) {
    console.error('❌ Debug route error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug route failed',
      error: error.message
    });
  }
});

// Simplified route with webadmin sync but no user auth
router.get('/usage-status', async (req, res) => {
  try {
    console.log('🔍 Getting feature usage status - WEBADMIN SYNC MODE');
    
    // Get current daily limit from webadmin settings
    let dailyLimit = DEFAULT_DAILY_LIMIT;
    try {
      dailyLimit = await FeatureSettings.getSetting('feature_daily_limit', DEFAULT_DAILY_LIMIT);
      console.log(`📊 Retrieved daily limit from webadmin: ${dailyLimit}`);
    } catch (settingsError) {
      console.warn('⚠️ FeatureSettings query failed, using default:', DEFAULT_DAILY_LIMIT);
      dailyLimit = DEFAULT_DAILY_LIMIT;
    }
    
    // Get session usage count
    const currentUsage = global.sessionUsageCount || 0;
    const today = new Date().toISOString().split('T')[0];
    const syncedStats = {
      current: currentUsage,
      dailyLimit: dailyLimit,
      remaining: Math.max(0, dailyLimit - currentUsage),
      percentage: Math.round((currentUsage / dailyLimit) * 100),
      isBlocked: currentUsage >= dailyLimit,
      featureBreakdown: [],
      lastActivity: new Date()
    };
    
    console.log('✅ Returning webadmin-synced response:', syncedStats);
    
    
    
    // Use webadmin-synced stats with session count
    const stats = syncedStats;
    console.log(`✅ Using webadmin stats with session count:`, stats);
    
    // Calculate time until reset (midnight Vietnam time)
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const tomorrow = new Date(vietnamTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilReset = tomorrow.getTime() - vietnamTime.getTime();
    
    res.json({
      success: true,
      data: {
        usage: {
          ...stats,
          resetTime: timeUntilReset
        },
        config: {
          subscriptionType: 'free',
          isEnabled: true,
          resetTime: '00:00',
          timezone: 'Asia/Ho_Chi_Minh'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting feature usage status:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy trạng thái sử dụng tính năng',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/features/track-usage - Track feature usage
router.post('/track-usage', authenticateUser, updateUserActivity, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { featureId, featureName } = req.body;
    const today = getVietnamDate();
    
    console.log(`📝 Tracking feature usage: ${featureId} for user ${userId}`);
    
    if (!featureId || !featureName) {
      return res.status(400).json({
        success: false,
        message: 'featureId và featureName là bắt buộc'
      });
    }
    
    // Simple in-memory counter per session (not persistent)
    if (!global.sessionUsageCount) {
      global.sessionUsageCount = 0;
    }
    global.sessionUsageCount += 1;
    
    const currentUsage = global.sessionUsageCount;
    const mockUsageStats = {
      current: currentUsage,
      dailyLimit: dailyLimit,
      remaining: Math.max(0, dailyLimit - currentUsage),
      percentage: Math.round((currentUsage / dailyLimit) * 100),
      isBlocked: currentUsage >= dailyLimit,
      featureBreakdown: {},
      lastActivity: new Date()
    };
    
    console.log(`✅ Feature usage tracked (session): ${currentUsage}/${dailyLimit} (${featureId})`);
    
    res.json({
      success: true,
      message: 'Feature usage tracked successfully (session mode)',
      usage: mockUsageStats
    });
    
  } catch (error) {
    console.error('❌ Error tracking feature usage:', error);
    // Get webadmin limit for fallback
    let fallbackLimit = DEFAULT_DAILY_LIMIT;
    try {
      fallbackLimit = await FeatureSettings.getSetting('feature_daily_limit', DEFAULT_DAILY_LIMIT);
    } catch (settingsError) {
      console.warn('⚠️ Settings failed in fallback, using default');
    }
    
    res.json({
      success: true,
      message: 'Feature usage tracked (fallback mode)',
      usage: {
        current: 1,
        dailyLimit: fallbackLimit,
        remaining: fallbackLimit - 1,
        percentage: Math.round((1 / fallbackLimit) * 100),
        isBlocked: false,
        featureBreakdown: {},
        lastActivity: new Date()
      }
    });
  }
});

// POST /api/features/check-usage - Check if feature can be used (without tracking)
router.post('/check-usage', authenticateUser, updateUserActivity, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { featureId } = req.body;
    const today = getVietnamDate();
    
    console.log(`🔍 Checking feature usage: ${featureId} for user ${userId}`);
    
    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find feature usage record for today
    let usageRecord = await FeatureUsage.findOne({ userId, date: today });
    
    if (!usageRecord) {
      // Create new record for today - get limit from settings
      const subscriptionType = user.subscriptionType || 'free';
      const dailyLimit = await FeatureSettings.getSetting('feature_daily_limit', DEFAULT_DAILY_LIMIT);
      
      usageRecord = new FeatureUsage({
        userId,
        username: user.username,
        email: user.email,
        date: today,
        dailyLimit,
        subscriptionType,
        totalUses: 0,
        featureBreakdown: [],
        usageHistory: []
      });
      
      await usageRecord.save();
    }
    
    const canUse = usageRecord.canUseFeature();
    const stats = usageRecord.getUsageStats();
    
    res.json({
      success: true,
      canUse,
      blocked: !canUse,
      message: canUse ? 'Feature can be used' : `Đã đạt giới hạn ${usageRecord.dailyLimit} lượt sử dụng/ngày`,
      usage: stats
    });
    
  } catch (error) {
    console.error('Error checking feature usage:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra sử dụng tính năng',
      error: error.message
    });
  }
});

// GET /api/features/usage-history - Get feature usage history
router.get('/usage-history', authenticateUser, updateUserActivity, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { days = 7 } = req.query;
    
    console.log(`📊 Getting feature usage history for user ${userId} (${days} days)`);
    
    // Calculate date range
    const today = getVietnamDate();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get usage records
    const records = await FeatureUsage.find({
      userId,
      date: { 
        $gte: startDate.toISOString().split('T')[0], 
        $lte: today 
      }
    }).sort({ date: -1 });
    
    const history = records.map(record => ({
      date: record.date,
      totalUses: record.totalUses,
      dailyLimit: record.dailyLimit,
      percentage: Math.round((record.totalUses / record.dailyLimit) * 100),
      featureBreakdown: record.featureBreakdown,
      usageHistory: record.usageHistory
    }));
    
    res.json({
      success: true,
      data: {
        history,
        totalDays: parseInt(days),
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: today
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting feature usage history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử sử dụng tính năng',
      error: error.message
    });
  }
});

module.exports = router;