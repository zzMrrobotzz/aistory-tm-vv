const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/adminAuth');
const { updateUserActivity } = require('../middleware/activityTracker');
const DailyUsageLimit = require('../models/DailyUsageLimit');
const User = require('../models/User');
const { getVietnamDate } = require('../utils/timezone');

// Middleware để extract userId từ token
const extractUserId = (req, res, next) => {
  try {
    // Token structure: { user: { id: userId } }
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

// POST /api/requests/check-and-track - Kiểm tra và ghi nhận request
router.post('/check-and-track', authenticateUser, updateUserActivity, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { action, itemCount = 1 } = req.body;
    const today = getVietnamDate();
    
    console.log(`Checking and tracking request for user ${userId}, action: ${action}, itemCount: ${itemCount}`);
    
    // Chỉ track usage cho các modules được giới hạn
    const limitedModules = ['write-story', 'quick-story', 'rewrite'];
    const isLimitedModule = limitedModules.includes(action);
    
    if (!isLimitedModule) {
      // Module không bị giới hạn, cho phép sử dụng
      return res.json({
        success: true,
        blocked: false,
        message: 'Module không bị giới hạn - sử dụng tự do',
        usage: {
          current: 0,
          limit: 1000,
          remaining: 1000,
          percentage: 0,
          isBlocked: false
        }
      });
    }
    
    // Tìm hoặc tạo record cho hôm nay
    let usageRecord = await DailyUsageLimit.findOne({ userId, date: today });
    
    if (!usageRecord) {
      // Lấy thông tin user để tạo record mới
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Tạo record mới với limit mặc định
      usageRecord = new DailyUsageLimit({
        userId,
        username: user.username,
        email: user.email,
        date: today,
        dailyLimit: 1000,
        subscriptionType: user.subscriptionType || 'free',
        totalUsage: 0,
        moduleUsage: [],
        requestHistory: [],
        warningsIssued: []
      });
      
      await usageRecord.save();
      console.log(`Created new usage record for user ${userId}`);
    } else {
      // Auto-update existing records with old dailyLimit to new limit
      if (usageRecord.dailyLimit < 1000) {
        usageRecord.dailyLimit = 1000;
        await usageRecord.save();
        console.log(`Updated dailyLimit to 1000 for user ${userId}`);
      }
    }
    
    // Kiểm tra xem có bị block không (bao gồm itemCount sắp thêm vào)
    const newTotalUsage = usageRecord.totalUsage + itemCount;
    if (newTotalUsage > usageRecord.dailyLimit) {
      const remainingSlots = Math.max(0, usageRecord.dailyLimit - usageRecord.totalUsage);
      return res.status(429).json({
        success: false,
        blocked: true,
        message: `Bạn chỉ còn ${remainingSlots} lần sử dụng, không đủ cho ${itemCount} bài viết. Vui lòng thử lại vào ngày mai hoặc giảm số lượng.`,
        usage: {
          current: usageRecord.totalUsage,
          limit: usageRecord.dailyLimit,
          remaining: remainingSlots,
          percentage: 100,
          isBlocked: true,
          requestedItems: itemCount,
          availableSlots: remainingSlots
        }
      });
    }
    
    // Tăng usage count theo số lượng items được process
    usageRecord.totalUsage += itemCount;
    
    // Cập nhật module usage dựa trên action
    const moduleId = action || 'unknown';
    const moduleIndex = usageRecord.moduleUsage.findIndex(m => m.moduleId === moduleId);
    if (moduleIndex >= 0) {
      usageRecord.moduleUsage[moduleIndex].requestCount += 1;
      usageRecord.moduleUsage[moduleIndex].weightedUsage += itemCount;
      usageRecord.moduleUsage[moduleIndex].lastUsed = new Date();
    } else {
      usageRecord.moduleUsage.push({
        moduleId,
        moduleName: moduleId, // Use moduleId as moduleName for now
        requestCount: 1,
        weightedUsage: itemCount,
        lastUsed: new Date()
      });
    }
    
    // Thêm vào request history
    usageRecord.requestHistory.push({
      timestamp: new Date(),
      moduleId,
      weight: itemCount
    });
    
    // Giữ chỉ 100 records gần nhất
    if (usageRecord.requestHistory.length > 100) {
      usageRecord.requestHistory = usageRecord.requestHistory.slice(-100);
    }
    
    await usageRecord.save();
    
    console.log(`Request tracked for user ${userId}: ${usageRecord.totalUsage}/${usageRecord.dailyLimit} (added ${itemCount} items)`);
    
    res.json({
      success: true,
      blocked: false,
      message: 'Request allowed',
      usage: {
        current: usageRecord.totalUsage,
        limit: usageRecord.dailyLimit,
        remaining: Math.max(0, usageRecord.dailyLimit - usageRecord.totalUsage),
        percentage: Math.min(100, (usageRecord.totalUsage / usageRecord.dailyLimit) * 100),
        isBlocked: false
      }
    });
    
  } catch (error) {
    console.error('Error in check-and-track:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra và ghi nhận request',
      error: error.message
    });
  }
});

// GET /api/requests/today-record - Lấy record hôm nay
router.get('/today-record', authenticateUser, updateUserActivity, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const today = getVietnamDate();
    
    console.log(`Getting today record for user ${userId} on ${today}`);
    
    // Tìm hoặc tạo record cho hôm nay
    let usageRecord = await DailyUsageLimit.findOne({ userId, date: today });
    
    if (!usageRecord) {
      // Lấy thông tin user để tạo record mới
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Tạo record mới với limit mặc định
      usageRecord = new DailyUsageLimit({
        userId,
        username: user.username,
        email: user.email,
        date: today,
        dailyLimit: 1000,
        subscriptionType: user.subscriptionType || 'free',
        totalUsage: 0,
        moduleUsage: [],
        requestHistory: [],
        warningsIssued: []
      });
      
      await usageRecord.save();
      console.log(`Created new usage record for user ${userId}`);
    } else {
      // Auto-update existing records with old dailyLimit to new limit
      if (usageRecord.dailyLimit < 1000) {
        usageRecord.dailyLimit = 1000;
        await usageRecord.save();
        console.log(`Updated dailyLimit to 1000 for user ${userId}`);
      }
    }
    
    // Tính toán thời gian reset
    const now = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timeUntilReset = tomorrow - now;
    
    res.json({
      success: true,
      data: {
        userId: usageRecord.userId,
        date: usageRecord.date,
        requestCount: usageRecord.totalUsage,
        dailyLimit: usageRecord.dailyLimit,
        remaining: Math.max(0, usageRecord.dailyLimit - usageRecord.totalUsage),
        percentage: Math.min(100, (usageRecord.totalUsage / usageRecord.dailyLimit) * 100),
        isBlocked: usageRecord.totalUsage >= usageRecord.dailyLimit,
        moduleUsage: usageRecord.moduleUsage,
        resetTime: timeUntilReset
      }
    });
    
  } catch (error) {
    console.error('Error getting today record:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy record hôm nay',
      error: error.message
    });
  }
});

module.exports = router;