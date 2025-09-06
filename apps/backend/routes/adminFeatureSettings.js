const express = require('express');
const router = express.Router();
const FeatureSettings = require('../models/FeatureSettings');
const FeatureUsage = require('../models/FeatureUsage');

// GET /api/admin/feature-settings - Get all feature settings
router.get('/', async (req, res) => {
  try {
    console.log('📊 Admin getting feature settings...');
    
    const settings = await FeatureSettings.find({ isActive: true }).sort({ category: 1, settingKey: 1 });
    
    // Group settings by category for better organization
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push({
        key: setting.settingKey,
        value: setting.settingValue,
        type: setting.settingType,
        description: setting.description,
        lastModified: setting.lastModified,
        modifiedBy: setting.modifiedBy
      });
      return acc;
    }, {});
    
    res.json({
      success: true,
      data: {
        settings: groupedSettings,
        totalSettings: settings.length
      }
    });
    
  } catch (error) {
    console.error('Error getting feature settings:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy cấu hình tính năng',
      error: error.message
    });
  }
});

// SPECIFIC ROUTES MUST COME BEFORE DYNAMIC ROUTES
// POST /api/admin/feature-settings/reset-all-usage - Reset session usage counter (emergency)
router.post('/reset-all-usage', async (req, res) => {
  console.log('🔥 DEBUG: reset-all-usage route called - MOVED TO TOP');
  console.log('🔥 DEBUG: req.method =', req.method);
  console.log('🔥 DEBUG: req.body =', JSON.stringify(req.body));
  
  try {
    const adminUser = req.user?.username || 'webadmin';
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🚨 Admin ${adminUser} resetting session usage counter for ${today}`);
    
    // Reset the enhanced tracking system
    const previousCount = global.featureTracking?.totalUsage || global.sessionUsageCount || 0;
    
    // Reset both old and new tracking systems
    global.sessionUsageCount = 0;
    global.featureTracking = {
      totalUsage: 0,
      featureBreakdown: {},
      userBreakdown: {},
      lastReset: today
    };
    
    console.log(`✅ Reset enhanced tracking system from ${previousCount} to 0`);
    
    // Also reset any database records if they exist (legacy cleanup)
    let dbResetCount = 0;
    try {
      const result = await FeatureUsage.updateMany(
        { date: today },
        {
          $set: {
            totalUses: 0,
            featureBreakdown: [],
            usageHistory: [],
            lastActivity: new Date()
          }
        }
      );
      dbResetCount = result.modifiedCount;
      if (dbResetCount > 0) {
        console.log(`✅ Also reset ${dbResetCount} database usage records`);
      }
    } catch (dbError) {
      console.warn('Database reset failed (not critical):', dbError.message);
    }
    
    res.json({
      success: true,
      message: `Đã reset usage counter từ ${previousCount} về 0`,
      data: {
        sessionResetFrom: previousCount,
        sessionResetTo: 0,
        dbResetCount: dbResetCount,
        date: today,
        resetBy: adminUser
      }
    });
    
  } catch (error) {
    console.error('Error resetting usage:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi reset usage',
      error: error.message
    });
  }
});

// POST /api/admin/feature-settings/:key - Update specific setting (AFTER SPECIFIC ROUTES)
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description, type = 'string', category = 'general' } = req.body;
    const adminUser = req.user?.username || 'admin';
    
    console.log(`🔧 Admin updating setting: ${key} = ${value} (${type})`);
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Giá trị setting là bắt buộc'
      });
    }
    
    // Validate specific settings
    if (key === 'feature_daily_limit') {
      const numValue = Number(value);
      if (isNaN(numValue) || numValue < 1 || numValue > 50000) {
        return res.status(400).json({
          success: false,
          message: 'Giới hạn hàng ngày phải từ 1-50000'
        });
      }
    }
    
    const setting = await FeatureSettings.setSetting(
      key,
      value,
      description,
      type,
      category,
      adminUser
    );
    
    console.log(`✅ Setting updated: ${key} = ${value}`);
    
    res.json({
      success: true,
      message: 'Cấu hình đã được cập nhật',
      data: {
        key: setting.settingKey,
        value: setting.settingValue,
        type: setting.settingType,
        description: setting.description,
        lastModified: setting.lastModified,
        modifiedBy: setting.modifiedBy
      }
    });
    
  } catch (error) {
    console.error('Error updating feature setting:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật cấu hình',
      error: error.message
    });
  }
});

// GET /api/admin/feature-settings/stats - Get enhanced feature usage statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📈 Admin getting enhanced feature usage statistics...');
    
    const currentLimit = await FeatureSettings.getSetting('feature_daily_limit', 300);
    const tracking = global.featureTracking || { totalUsage: 0, featureBreakdown: {}, userBreakdown: {} };
    const currentUsage = tracking.totalUsage;
    const today = new Date().toISOString().split('T')[0];
    
    // Enhanced statistics
    const isBlocked = currentUsage >= currentLimit;
    const utilizationRate = currentLimit > 0 ? Math.round((currentUsage / currentLimit) * 100) : 0;
    const totalUsers = Object.keys(tracking.userBreakdown).length;
    
    // Calculate user stats
    const userUsages = Object.values(tracking.userBreakdown).map(user => user.total);
    const averageUsage = totalUsers > 0 ? Math.round(userUsages.reduce((a, b) => a + b, 0) / totalUsers) : 0;
    const maxUsage = userUsages.length > 0 ? Math.max(...userUsages) : 0;
    const blockedUsers = userUsages.filter(usage => usage >= currentLimit).length;
    
    const enhancedStats = {
      totalUsers: totalUsers,
      totalUsage: currentUsage,
      averageUsage: averageUsage,
      maxUsage: maxUsage,
      blockedUsers: blockedUsers,
      utilizationRate: utilizationRate
    };
    
    // Real feature breakdown from tracking
    const featureBreakdown = Object.entries(tracking.featureBreakdown).map(([featureId, data]) => ({
      _id: featureId,
      featureName: data.featureName,
      totalUses: data.count,
      userCount: data.users.size
    })).sort((a, b) => b.totalUses - a.totalUses);
    
    // Top users analysis
    const topUsers = Object.entries(tracking.userBreakdown)
      .map(([userId, userData]) => {
        // Find user's most used feature
        const userFeatures = Object.entries(userData.features);
        const topFeature = userFeatures.reduce((max, [featureId, count]) => 
          count > max.count ? { featureId, count } : max, 
          { featureId: null, count: 0 }
        );
        
        return {
          userId: userId.length > 15 ? userId.substring(0, 15) + '...' : userId, // Truncate long IPs
          totalUsage: userData.total,
          topFeature: topFeature.featureId ? {
            featureId: topFeature.featureId,
            featureName: tracking.featureBreakdown[topFeature.featureId]?.featureName || topFeature.featureId,
            count: topFeature.count
          } : null,
          featuresUsed: Object.keys(userData.features).length
        };
      })
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, 10); // Top 10 users
    
    // Simple weekly trend (enhanced data only available for today)
    const weeklyTrend = currentUsage > 0 ? [{
      _id: today,
      totalUsage: currentUsage,
      userCount: totalUsers
    }] : [];
    
    console.log(`📊 Enhanced stats: ${currentUsage}/${currentLimit} (${utilizationRate}%), users: ${totalUsers}, features: ${featureBreakdown.length}`);
    
    res.json({
      success: true,
      data: {
        currentLimit,
        todayStats: enhancedStats,
        featureBreakdown,
        topUsers, // New: Top user analytics
        weeklyTrend
      }
    });
    
  } catch (error) {
    console.error('Error getting feature statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê tính năng',
      error: error.message
    });
  }
});

// POST /api/admin/feature-settings/initialize - Initialize default settings
router.post('/initialize', async (req, res) => {
  try {
    console.log('🔧 Admin initializing default feature settings...');
    
    await FeatureSettings.initializeDefaults();
    
    res.json({
      success: true,
      message: 'Đã khởi tạo cấu hình mặc định'
    });
    
  } catch (error) {
    console.error('Error initializing settings:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi khởi tạo cấu hình',
      error: error.message
    });
  }
});

module.exports = router;