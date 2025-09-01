const mongoose = require('mongoose');

// Simplified Request Tracking Schema
const RequestTrackingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    index: true
  },
  requestCount: {
    type: Number,
    default: 0,
    min: 0
  },
  dailyLimit: {
    type: Number,
    default: 200
  },
  lastRequestAt: {
    type: Date,
    default: Date.now
  },
  // Simple request history
  requests: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      required: true // e.g. "write-story", "rewrite", "image-gen", etc.
    }
  }]
}, {
  timestamps: true
});

// Compound index for efficient queries
RequestTrackingSchema.index({ userId: 1, date: 1 }, { unique: true });

// Instance methods
RequestTrackingSchema.methods.canMakeRequest = function() {
  return this.requestCount < this.dailyLimit;
};

RequestTrackingSchema.methods.getRemainingRequests = function() {
  return Math.max(0, this.dailyLimit - this.requestCount);
};

RequestTrackingSchema.methods.getUsagePercentage = function() {
  return Math.round((this.requestCount / this.dailyLimit) * 100);
};

RequestTrackingSchema.methods.addRequest = function(action) {
  this.requestCount += 1;
  this.lastRequestAt = new Date();
  this.requests.push({
    timestamp: new Date(),
    action: action
  });
  
  // Keep only last 50 requests to avoid document bloat
  if (this.requests.length > 50) {
    this.requests = this.requests.slice(-50);
  }
};

// Static methods
RequestTrackingSchema.statics.getTodayRecord = async function(userId) {
  // Use Vietnam timezone instead of UTC
  const { getVietnamDate } = require('../utils/timezone');
  const today = getVietnamDate();

  // Atomic upsert to avoid duplicate key race conditions
  const filter = { userId, date: today };
  const update = {
    $setOnInsert: {
      userId,
      date: today,
      requestCount: 0,
      dailyLimit: 200,
      lastRequestAt: new Date(),
      requests: []
    }
  };
  const options = { new: true, upsert: true, setDefaultsOnInsert: true };

  const record = await this.findOneAndUpdate(filter, update, options);
  return record;
};

RequestTrackingSchema.statics.checkAndIncrementRequest = async function(userId, action) {
  const record = await this.getTodayRecord(userId);
  
  // Check if user can make request
  if (!record.canMakeRequest()) {
    return {
      success: false,
      blocked: true,
      message: `Đã đạt giới hạn ${record.dailyLimit} requests/ngày. Vui lòng thử lại vào ngày mai.`,
      usage: {
        current: record.requestCount,
        limit: record.dailyLimit,
        remaining: record.getRemainingRequests(),
        percentage: record.getUsagePercentage()
      }
    };
  }
  
  // Add the request
  record.addRequest(action);
  await record.save();
  
  const newUsage = {
    current: record.requestCount,
    limit: record.dailyLimit,
    remaining: record.getRemainingRequests(),
    percentage: record.getUsagePercentage()
  };
  
  // Check if approaching limit
  let warning = null;
  if (newUsage.percentage >= 90) {
    warning = `⚠️ Cảnh báo: Đã sử dụng ${newUsage.percentage}% (${newUsage.current}/${newUsage.limit}). Chỉ còn ${newUsage.remaining} requests!`;
  } else if (newUsage.percentage >= 75) {
    warning = `ℹ️ Thông báo: Đã sử dụng ${newUsage.percentage}% quota hôm nay (${newUsage.current}/${newUsage.limit})`;
  }
  
  return {
    success: true,
    blocked: false,
    message: 'Request recorded successfully',
    usage: newUsage,
    warning
  };
};

RequestTrackingSchema.statics.getUserHistory = async function(userId, days = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  
  const records = await this.find({
    userId,
    date: { $gte: startDateStr, $lte: endDateStr }
  }).sort({ date: -1 });
  
  return records;
};

const RequestTracking = mongoose.model('RequestTracking', RequestTrackingSchema);
module.exports = RequestTracking;