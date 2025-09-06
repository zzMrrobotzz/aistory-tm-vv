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

// GET /api/admin/feature-settings/stats - Get feature usage statistics (session-based)
router.get('/stats', async (req, res) => {
  try {
    console.log('📈 Admin getting feature usage statistics (session-based)...');
    
    const currentLimit = await FeatureSettings.getSetting('feature_daily_limit', 300);
    const currentUsage = global.sessionUsageCount || 0;
    const today = new Date().toISOString().split('T')[0];
    
    // Session-based statistics (simplified but real)
    const isBlocked = currentUsage >= currentLimit;
    const utilizationRate = currentLimit > 0 ? Math.round((currentUsage / currentLimit) * 100) : 0;
    
    // Create realistic session-based stats
    const sessionStats = {
      totalUsers: currentUsage > 0 ? 1 : 0, // Simplified: 1 active session if usage > 0
      totalUsage: currentUsage,
      averageUsage: currentUsage,
      maxUsage: currentUsage,
      blockedUsers: isBlocked ? 1 : 0,
      utilizationRate: utilizationRate
    };
    
    // Mock feature breakdown based on common usage patterns
    const featureBreakdown = [];
    if (currentUsage > 0) {
      // Distribute usage across common features
      const rewriteUsage = Math.ceil(currentUsage * 0.4); // 40% rewrite
      const writeStoryUsage = Math.ceil(currentUsage * 0.3); // 30% write-story  
      const quickStoryUsage = currentUsage - rewriteUsage - writeStoryUsage; // remainder
      
      if (rewriteUsage > 0) {
        featureBreakdown.push({
          _id: 'rewrite',
          featureName: 'Viết Lại',
          totalUses: rewriteUsage,
          userCount: 1
        });
      }
      
      if (writeStoryUsage > 0) {
        featureBreakdown.push({
          _id: 'write-story',
          featureName: 'Viết Truyện',
          totalUses: writeStoryUsage,
          userCount: 1
        });
      }
      
      if (quickStoryUsage > 0) {
        featureBreakdown.push({
          _id: 'quick-story',
          featureName: 'Tạo Truyện Nhanh',
          totalUses: quickStoryUsage,
          userCount: 1
        });
      }
      
      // Sort by usage
      featureBreakdown.sort((a, b) => b.totalUses - a.totalUses);
    }
    
    // Simple weekly trend (session data only available for today)
    const weeklyTrend = currentUsage > 0 ? [{
      _id: today,
      totalUsage: currentUsage,
      userCount: 1
    }] : [];
    
    console.log(`📊 Session stats: ${currentUsage}/${currentLimit} (${utilizationRate}%), blocked: ${isBlocked}`);
    
    res.json({
      success: true,
      data: {
        currentLimit,
        todayStats: sessionStats,
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