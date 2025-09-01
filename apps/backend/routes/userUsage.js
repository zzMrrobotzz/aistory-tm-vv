const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/adminAuth');
const DailyUsageLimit = require('../models/DailyUsageLimit');
const User = require('../models/User');
const { getVietnamDate } = require('../utils/timezone');

// Middleware để extract userId từ token
const extractUserId = (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
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

// GET /api/user/usage-status - Lấy trạng thái usage hiện tại
router.get('/usage-status', authenticateUser, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const today = getVietnamDate();
    
    console.log(`Getting usage status for user ${userId} on ${today}`);
    
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
        requestCount: 0,
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
    
    const usageData = {
      current: usageRecord.requestCount,
      limit: usageRecord.dailyLimit,
      remaining: Math.max(0, usageRecord.dailyLimit - usageRecord.requestCount),
      percentage: Math.min(100, (usageRecord.requestCount / usageRecord.dailyLimit) * 100),
      isBlocked: usageRecord.requestCount >= usageRecord.dailyLimit,
      resetTime: timeUntilReset
    };
    
    console.log(`Usage status for user ${userId}:`, usageData);
    
    res.json({
      success: true,
      data: {
        usage: usageData,
        config: {
          resetTime: timeUntilReset
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting usage status:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy trạng thái usage',
      error: error.message
    });
  }
});

// POST /api/user/record-usage - Ghi nhận usage (đơn giản hóa)
router.post('/record-usage', authenticateUser, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { moduleId, action } = req.body;
    const today = getVietnamDate();
    
    console.log(`Recording usage for user ${userId}, module: ${moduleId}, action: ${action}`);
    
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
      
      // Tạo record mới
      usageRecord = new DailyUsageLimit({
        userId,
        username: user.username,
        email: user.email,
        date: today,
        dailyLimit: 200,
        subscriptionType: user.subscriptionType || 'free',
        requestCount: 0,
        moduleUsage: [],
        requestHistory: [],
        warningsIssued: []
      });
    }
    
    // Tăng request count
    usageRecord.requestCount += 1;
    
    // Cập nhật module usage
    const moduleIndex = usageRecord.moduleUsage.findIndex(m => m.moduleId === moduleId);
    if (moduleIndex >= 0) {
      usageRecord.moduleUsage[moduleIndex].count += 1;
    } else {
      usageRecord.moduleUsage.push({
        moduleId,
        count: 1,
        lastUsed: new Date()
      });
    }
    
    // Thêm vào request history
    usageRecord.requestHistory.push({
      timestamp: new Date(),
      moduleId,
      action: action || 'generate'
    });
    
    // Giữ chỉ 100 records gần nhất
    if (usageRecord.requestHistory.length > 100) {
      usageRecord.requestHistory = usageRecord.requestHistory.slice(-100);
    }
    
    await usageRecord.save();
    
    console.log(`Usage recorded for user ${userId}: ${usageRecord.requestCount}/${usageRecord.dailyLimit}`);
    
    res.json({
      success: true,
      message: 'Usage recorded successfully',
      data: {
        current: usageRecord.requestCount,
        limit: usageRecord.dailyLimit,
        remaining: Math.max(0, usageRecord.dailyLimit - usageRecord.requestCount),
        isBlocked: usageRecord.requestCount >= usageRecord.dailyLimit
      }
    });
    
  } catch (error) {
    console.error('Error recording usage:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi ghi nhận usage',
      error: error.message
    });
  }
});

// GET /api/user/usage-history - Lấy lịch sử usage
router.get('/usage-history', authenticateUser, extractUserId, async (req, res) => {
  try {
    const userId = req.userId;
    const { days = 7 } = req.query;
    
    const endDate = getVietnamDate();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const history = await DailyUsageLimit.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });
    
    res.json({
      success: true,
      data: {
        history: history.map(record => ({
          date: record.date,
          requestCount: record.requestCount,
          dailyLimit: record.dailyLimit,
          moduleUsage: record.moduleUsage
        }))
      }
    });
    
  } catch (error) {
    console.error('Error getting usage history:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử usage',
      error: error.message
    });
  }
});

module.exports = router;