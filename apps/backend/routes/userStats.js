const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/user/usage-stats
// @desc    Get user usage statistics
// @access  Private
router.get('/usage-stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Initialize usage stats if not exists
    if (!user.usageStats) {
      user.usageStats = {
        totalApiCalls: 0,
        todayApiCalls: 0,
        weeklyApiCalls: 0,
        monthlyApiCalls: 0,
        storiesGenerated: 0,
        imagesGenerated: 0,
        textRewritten: 0,
        videosCreated: 0,
        favoriteModule: 'Viết Truyện',
        lastActiveDate: user.createdAt,
        dailyUsage: [],
        moduleUsage: {}
      };
      await user.save();
    }

    // Calculate current stats from daily usage logs
    const dailyUsage = user.usageStats.dailyUsage || [];
    
    // Today's usage
    const todayUsage = dailyUsage.find(day => 
      new Date(day.date).toDateString() === today.toDateString()
    );
    const todayApiCalls = todayUsage ? todayUsage.apiCalls : 0;

    // Weekly usage
    const weeklyApiCalls = dailyUsage
      .filter(day => new Date(day.date) >= weekAgo)
      .reduce((sum, day) => sum + (day.apiCalls || 0), 0);

    // Monthly usage
    const monthlyApiCalls = dailyUsage
      .filter(day => new Date(day.date) >= monthAgo)
      .reduce((sum, day) => sum + (day.apiCalls || 0), 0);

    // Find favorite module
    const moduleUsage = user.usageStats.moduleUsage || {};
    let favoriteModule = 'Viết Truyện';
    if (Object.keys(moduleUsage).length > 0) {
      let maxUsage = 0;
      for (const [moduleName, usage] of Object.entries(moduleUsage)) {
        if (usage > maxUsage) {
          maxUsage = usage;
          favoriteModule = moduleName;
        }
      }
    }

    // Response data
    const usageStats = {
      totalApiCalls: user.usageStats.totalApiCalls || 0,
      todayApiCalls,
      weeklyApiCalls,
      monthlyApiCalls,
      favoriteModule,
      lastActiveDate: user.usageStats.lastActiveDate || user.createdAt,
      storiesGenerated: user.usageStats.storiesGenerated || 0,
      imagesGenerated: user.usageStats.imagesGenerated || 0,
      textRewritten: user.usageStats.textRewritten || 0,
      videosCreated: user.usageStats.videosCreated || 0,
      // Additional metrics
      accountAge: Math.floor((now - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
      subscriptionStatus: user.subscriptionType || 'free',
      isActiveToday: todayApiCalls > 0
    };

    res.json({
      success: true,
      data: usageStats
    });

  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching usage statistics' 
    });
  }
});

// @route   POST /api/user/log-usage
// @desc    Log user activity (called by frontend when user uses features)
// @access  Private
router.post('/log-usage', auth, async (req, res) => {
  try {
    const { module, action, count = 1 } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize usage stats if not exists
    if (!user.usageStats) {
      user.usageStats = {
        totalApiCalls: 0,
        storiesGenerated: 0,
        imagesGenerated: 0,
        textRewritten: 0,
        videosCreated: 0,
        favoriteModule: 'Viết Truyện',
        lastActiveDate: new Date(),
        dailyUsage: [],
        moduleUsage: {}
      };
    }

    // Ensure moduleUsage is an object, not a Map
    if (!user.usageStats.moduleUsage || typeof user.usageStats.moduleUsage !== 'object') {
      user.usageStats.moduleUsage = {};
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Update daily usage
    let todayUsage = user.usageStats.dailyUsage.find(day => 
      day.date.toISOString().split('T')[0] === todayStr
    );

    if (!todayUsage) {
      todayUsage = {
        date: today,
        apiCalls: 0,
        modules: {}
      };
      user.usageStats.dailyUsage.push(todayUsage);
    }

    // Log the activity
    todayUsage.apiCalls += count;
    todayUsage.modules[module] = (todayUsage.modules[module] || 0) + count;

    // Update overall stats
    user.usageStats.totalApiCalls += count;
    user.usageStats.moduleUsage[module] = (user.usageStats.moduleUsage[module] || 0) + count;
    user.usageStats.lastActiveDate = today;

    // Update specific counters based on action
    switch (action) {
      case 'story_generated':
        user.usageStats.storiesGenerated += count;
        break;
      case 'image_generated':
        user.usageStats.imagesGenerated += count;
        break;
      case 'text_rewritten':
        user.usageStats.textRewritten += count;
        break;
      case 'video_created':
        user.usageStats.videosCreated += count;
        break;
    }

    // Keep only last 90 days of usage data
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    user.usageStats.dailyUsage = user.usageStats.dailyUsage.filter(day => 
      new Date(day.date) >= ninetyDaysAgo
    );

    try {
      await user.save();
      res.json({
        success: true,
        message: 'Usage logged successfully'
      });
    } catch (saveError) {
      console.error('Error saving user usage stats:', saveError);
      res.status(500).json({
        success: false,
        message: 'Error saving usage statistics'
      });
    }

  } catch (error) {
    console.error('Error logging usage:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while logging usage' 
    });
  }
});

module.exports = router;