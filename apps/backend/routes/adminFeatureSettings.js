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

// POST /api/admin/feature-settings/:key - Update specific setting
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

// GET /api/admin/feature-settings/stats - Get feature usage statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📈 Admin getting feature usage statistics...');
    
    const currentLimit = await FeatureSettings.getSetting('feature_daily_limit', 300);
    
    // Get today's usage stats
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await FeatureUsage.aggregate([
      { $match: { date: today } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalUsage: { $sum: '$totalUses' },
          averageUsage: { $avg: '$totalUses' },
          maxUsage: { $max: '$totalUses' },
          blockedUsers: {
            $sum: {
              $cond: [{ $gte: ['$totalUses', currentLimit] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    // Get feature breakdown
    const featureBreakdown = await FeatureUsage.aggregate([
      { $match: { date: today } },
      { $unwind: '$featureBreakdown' },
      {
        $group: {
          _id: '$featureBreakdown.featureId',
          featureName: { $first: '$featureBreakdown.featureName' },
          totalUses: { $sum: '$featureBreakdown.usageCount' },
          userCount: { $sum: 1 }
        }
      },
      { $sort: { totalUses: -1 } }
    ]);
    
    // Get weekly trend
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyTrend = await FeatureUsage.aggregate([
      { 
        $match: { 
          date: { 
            $gte: weekAgo.toISOString().split('T')[0],
            $lte: today
          }
        }
      },
      {
        $group: {
          _id: '$date',
          totalUsage: { $sum: '$totalUses' },
          userCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const stats = todayStats[0] || {
      totalUsers: 0,
      totalUsage: 0,
      averageUsage: 0,
      maxUsage: 0,
      blockedUsers: 0
    };
    
    res.json({
      success: true,
      data: {
        currentLimit,
        todayStats: {
          totalUsers: stats.totalUsers,
          totalUsage: stats.totalUsage,
          averageUsage: Math.round(stats.averageUsage || 0),
          maxUsage: stats.maxUsage,
          blockedUsers: stats.blockedUsers,
          utilizationRate: currentLimit > 0 ? Math.round((stats.totalUsage / (stats.totalUsers * currentLimit)) * 100) : 0
        },
        featureBreakdown,
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

// POST /api/admin/feature-settings/reset-all-usage - Reset session usage counter (emergency)
router.post('/reset-all-usage', async (req, res) => {
  try {
    const adminUser = req.user?.username || 'webadmin';
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`🚨 Admin ${adminUser} resetting session usage counter for ${today}`);
    
    // Reset the global session counter (current tracking system)
    const previousCount = global.sessionUsageCount || 0;
    global.sessionUsageCount = 0;
    
    console.log(`✅ Reset session usage counter from ${previousCount} to 0`);
    
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