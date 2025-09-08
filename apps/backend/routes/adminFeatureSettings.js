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
    
    // 🔥 NEW: Reset TODAY'S database records but preserve historical data
    let dbResetCount = 0;
    try {
      const FeatureUsage = require('../models/FeatureUsage');
      
      // Only reset TODAY's records, not historical data
      const result = await FeatureUsage.updateMany(
        { date: today }, // Only today's records
        {
          $set: {
            totalUses: 0,
            featureBreakdown: [], // Reset today's feature breakdown
            // Keep usageHistory for historical analysis but could clear if needed
            lastActivity: new Date()
          }
        }
      );
      dbResetCount = result.modifiedCount;
      if (dbResetCount > 0) {
        console.log(`✅ Reset ${dbResetCount} TODAY'S database usage records (preserving historical data)`);
      } else {
        console.log(`📊 No today's usage records to reset (${today})`);
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

// GET /api/admin/feature-settings/stats - Get enhanced feature usage statistics with database persistence
router.get('/stats', async (req, res) => {
  try {
    console.log('📈 Admin getting PERSISTENT feature usage statistics...');
    
    const currentLimit = await FeatureSettings.getSetting('feature_daily_limit', 300);
    const today = new Date().toISOString().split('T')[0];
    
    // 🔥 NEW: Get data from DATABASE instead of memory for persistence
    const FeatureUsage = require('../models/FeatureUsage');
    const User = require('../models/User');
    
    // Get today's actual usage from database
    const todayUsageRecords = await FeatureUsage.find({ date: today });
    const totalUsersToday = todayUsageRecords.length;
    const totalUsageToday = todayUsageRecords.reduce((sum, record) => sum + record.totalUses, 0);
    
    // Calculate user stats from actual database data
    const userUsages = todayUsageRecords.map(record => record.totalUses);
    const averageUsage = totalUsersToday > 0 ? Math.round(totalUsageToday / totalUsersToday) : 0;
    const maxUsage = userUsages.length > 0 ? Math.max(...userUsages) : 0;
    const blockedUsers = userUsages.filter(usage => usage >= currentLimit).length;
    const utilizationRate = currentLimit > 0 ? Math.round((totalUsageToday / (currentLimit * Math.max(1, totalUsersToday))) * 100) : 0;
    
    const enhancedStats = {
      totalUsers: totalUsersToday,
      totalUsage: totalUsageToday,
      averageUsage: averageUsage,
      maxUsage: maxUsage,
      blockedUsers: blockedUsers,
      utilizationRate: utilizationRate
    };
    
    // Feature breakdown from database records
    const featureBreakdownMap = {};
    todayUsageRecords.forEach(record => {
      record.featureBreakdown.forEach(feature => {
        if (!featureBreakdownMap[feature.featureId]) {
          featureBreakdownMap[feature.featureId] = {
            featureName: feature.featureName,
            totalUses: 0,
            userCount: new Set()
          };
        }
        featureBreakdownMap[feature.featureId].totalUses += feature.usageCount;
        featureBreakdownMap[feature.featureId].userCount.add(record.userId.toString());
      });
    });
    
    const featureBreakdown = Object.entries(featureBreakdownMap).map(([featureId, data]) => ({
      _id: featureId,
      featureName: data.featureName,
      totalUses: data.totalUses,
      userCount: data.userCount.size
    })).sort((a, b) => b.totalUses - a.totalUses);
    
    // Top users analysis from database
    const topUsers = todayUsageRecords
      .map(record => {
        // Find user's most used feature
        const topFeature = record.featureBreakdown.reduce((max, feature) => 
          feature.usageCount > max.usageCount ? feature : max, 
          { featureId: null, featureName: null, usageCount: 0 }
        );
        
        return {
          userId: record.username, // Display username
          totalUsage: record.totalUses,
          topFeature: topFeature.featureId ? {
            featureId: topFeature.featureId,
            featureName: topFeature.featureName,
            count: topFeature.usageCount
          } : null,
          featuresUsed: record.featureBreakdown.length
        };
      })
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, 10);
    
    // Get 7-day trend from database (persistent data!)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const weeklyRecords = await FeatureUsage.find({ 
      date: { $gte: sevenDaysAgoStr, $lte: today } 
    });
    
    const weeklyTrendMap = {};
    weeklyRecords.forEach(record => {
      if (!weeklyTrendMap[record.date]) {
        weeklyTrendMap[record.date] = { totalUsage: 0, userCount: 0 };
      }
      weeklyTrendMap[record.date].totalUsage += record.totalUses;
      weeklyTrendMap[record.date].userCount++;
    });
    
    const weeklyTrend = Object.entries(weeklyTrendMap)
      .map(([date, data]) => ({
        _id: date,
        totalUsage: data.totalUsage,
        userCount: data.userCount
      }))
      .sort((a, b) => a._id.localeCompare(b._id));
    
    console.log(`📊 PERSISTENT stats: ${totalUsageToday}/${currentLimit} (${utilizationRate}%), users: ${totalUsersToday}, features: ${featureBreakdown.length}, 7-day trend: ${weeklyTrend.length} days`);
    
    // Also sync memory tracking with database for real-time updates
    if (!global.featureTracking) {
      global.featureTracking = { totalUsage: 0, featureBreakdown: {}, userBreakdown: {} };
    }
    
    res.json({
      success: true,
      data: {
        currentLimit,
        todayStats: enhancedStats,
        featureBreakdown,
        topUsers,
        weeklyTrend // Now shows real historical data!
      },
      dataSource: 'database', // Indicate this is from persistent storage
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting PERSISTENT feature statistics:', error);
    
    // Fallback to memory tracking if database fails
    console.log('📊 Falling back to memory tracking...');
    const tracking = global.featureTracking || { totalUsage: 0, featureBreakdown: {}, userBreakdown: {} };
    
    res.json({
      success: true,
      data: {
        currentLimit: await FeatureSettings.getSetting('feature_daily_limit', 300),
        todayStats: {
          totalUsers: Object.keys(tracking.userBreakdown).length,
          totalUsage: tracking.totalUsage,
          averageUsage: 0,
          maxUsage: 0,
          blockedUsers: 0,
          utilizationRate: 0
        },
        featureBreakdown: [],
        topUsers: [],
        weeklyTrend: []
      },
      dataSource: 'memory-fallback',
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