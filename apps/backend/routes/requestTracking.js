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
    const { action } = req.body;
    const today = getVietnamDate();
    
    console.log(`Checking and tracking request for user ${userId}, action: ${action}`);
    
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
        dailyLimit: 200,
        subscriptionType: user.subscriptionType || 'free',
        totalUsage: 0,
        moduleUsage: [],
        requestHistory: [],
        warningsIssued: []
      });
      
      await usageRecord.save();
      console.log(`Created new usage record for user ${userId}`);
    }
    
    // Kiểm tra xem có bị block không
    if (usageRecord.totalUsage >= usageRecord.dailyLimit) {
      return res.status(429).json({
        success: false,
        blocked: true,
        message: 'Bạn đã đạt giới hạn request hôm nay. Vui lòng thử lại vào ngày mai.',
        usage: {
          current: usageRecord.totalUsage,
          limit: usageRecord.dailyLimit,
          remaining: 0,
          percentage: 100,
          isBlocked: true
        }
      });
    }
    
    // Tăng usage count
    usageRecord.totalUsage += 1;
    
    // Cập nhật module usage dựa trên action
    const moduleId = action || 'unknown';
    const moduleIndex = usageRecord.moduleUsage.findIndex(m => m.moduleId === moduleId);
    if (moduleIndex >= 0) {
      usageRecord.moduleUsage[moduleIndex].requestCount += 1;
      usageRecord.moduleUsage[moduleIndex].weightedUsage += 1;
      usageRecord.moduleUsage[moduleIndex].lastUsed = new Date();
    } else {
      usageRecord.moduleUsage.push({
        moduleId,
        moduleName: moduleId, // Use moduleId as moduleName for now
        requestCount: 1,
        weightedUsage: 1,
        lastUsed: new Date()
      });
    }
    
    // Thêm vào request history
    usageRecord.requestHistory.push({
      timestamp: new Date(),
      moduleId,
      weight: 1
    });
    
    // Giữ chỉ 100 records gần nhất
    if (usageRecord.requestHistory.length > 100) {
      usageRecord.requestHistory = usageRecord.requestHistory.slice(-100);
    }
    
    await usageRecord.save();
    
    console.log(`Request tracked for user ${userId}: ${usageRecord.totalUsage}/${usageRecord.dailyLimit}`);
    
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
        dailyLimit: 200,
        subscriptionType: user.subscriptionType || 'free',
        totalUsage: 0,
        moduleUsage: [],
        requestHistory: [],
        warningsIssued: []
      });
      
      await usageRecord.save();
      console.log(`Created new usage record for user ${userId}`);
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