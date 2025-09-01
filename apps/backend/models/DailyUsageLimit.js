const mongoose = require('mongoose');

const DailyUsageLimitSchema = new mongoose.Schema({
  // User identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  
  // Date tracking (YYYY-MM-DD format for easy querying)
  date: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Date must be in YYYY-MM-DD format'
    }
  },
  
  // Usage tracking
  totalUsage: {
    type: Number,
    default: 0,
    min: 0
  },
  dailyLimit: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Module-specific usage
  moduleUsage: [{
    moduleId: {
      type: String,
      required: true
      // Removed enum restriction to allow new modules like quick-story, etc.
    },
    moduleName: {
      type: String,
      required: true
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0
    },
    weightedUsage: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsed: {
      type: Date
    }
  }],
  
  // Burst tracking
  burstUsage: {
    currentBurst: {
      type: Number,
      default: 0
    },
    burstStartTime: {
      type: Date
    },
    lastBurstUsed: {
      type: Date
    },
    cooldownUntil: {
      type: Date
    }
  },
  
  // Request history for detailed analysis
  requestHistory: [{
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    moduleId: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      default: 1
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    requestId: {
      type: String // For tracking specific requests
    }
  }],
  
  // User subscription info at time of usage
  subscriptionType: {
    type: String,
    required: true,
    default: 'free'
    // Removed enum restriction to allow flexible subscription types including trial packages
  },
  
  // Status tracking  
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: {
    type: String
  },
  blockedAt: {
    type: Date
  },
  
  // Warning tracking
  warningsIssued: [{
    percentage: {
      type: Number,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    issuedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Performance metrics
  avgResponseTime: {
    type: Number, // in milliseconds
    default: 0
  },
  totalProcessingTime: {
    type: Number, // in milliseconds
    default: 0
  },
  
  // Meta information
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false // We manage dates manually for better control
});

// Compound indexes for efficient querying
DailyUsageLimitSchema.index({ userId: 1, date: 1 }, { unique: true });
DailyUsageLimitSchema.index({ date: 1, totalUsage: -1 });
DailyUsageLimitSchema.index({ subscriptionType: 1, date: 1 });
DailyUsageLimitSchema.index({ isBlocked: 1, date: 1 });
DailyUsageLimitSchema.index({ 'moduleUsage.moduleId': 1, date: 1 });

// Method to check if user has exceeded daily limit
DailyUsageLimitSchema.methods.hasExceededLimit = function() {
  return this.totalUsage >= this.dailyLimit;
};

// Method to get remaining quota
DailyUsageLimitSchema.methods.getRemainingQuota = function() {
  return Math.max(0, this.dailyLimit - this.totalUsage);
};

// Method to get usage percentage
DailyUsageLimitSchema.methods.getUsagePercentage = function() {
  if (this.dailyLimit === 0) return 0;
  return Math.round((this.totalUsage / this.dailyLimit) * 100);
};

// Method to add usage for a specific module
DailyUsageLimitSchema.methods.addUsage = function(moduleId, moduleName, weight = 1, metadata = {}) {
  // Update total usage
  this.totalUsage += weight;
  this.lastActivity = new Date();
  
  // Update module-specific usage
  let moduleUsage = this.moduleUsage.find(m => m.moduleId === moduleId);
  if (!moduleUsage) {
    moduleUsage = {
      moduleId,
      moduleName,
      requestCount: 0,
      weightedUsage: 0,
      lastUsed: new Date()
    };
    this.moduleUsage.push(moduleUsage);
  }
  
  moduleUsage.requestCount += 1;
  moduleUsage.weightedUsage += weight;
  moduleUsage.lastUsed = new Date();
  
  // Add to request history
  this.requestHistory.push({
    moduleId,
    weight,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId
  });
  
  // Keep request history to last 100 entries to prevent document size issues
  if (this.requestHistory.length > 100) {
    this.requestHistory = this.requestHistory.slice(-100);
  }
  
  return this;
};

// Method to check if user is in burst cooldown  
DailyUsageLimitSchema.methods.isInBurstCooldown = function() {
  return this.burstUsage.cooldownUntil && this.burstUsage.cooldownUntil > new Date();
};

// Method to can use burst
DailyUsageLimitSchema.methods.canUseBurst = function(burstLimit, burstWindowMinutes) {
  if (this.isInBurstCooldown()) return false;
  
  const now = new Date();
  const burstWindowMs = burstWindowMinutes * 60 * 1000;
  
  // Reset burst if window expired
  if (!this.burstUsage.burstStartTime || 
      (now - this.burstUsage.burstStartTime) > burstWindowMs) {
    this.burstUsage.currentBurst = 0;
    this.burstUsage.burstStartTime = now;
  }
  
  return this.burstUsage.currentBurst < burstLimit;
};

// Method to add warning
DailyUsageLimitSchema.methods.addWarning = function(percentage, message) {
  // Check if warning already issued for this percentage
  const existingWarning = this.warningsIssued.find(w => w.percentage === percentage);
  if (existingWarning) return false;
  
  this.warningsIssued.push({ percentage, message });
  return true;
};

// Static method to get or create daily usage for user
DailyUsageLimitSchema.statics.getOrCreateDaily = async function(userId, userInfo, dailyLimit) {
  console.log('getOrCreateDaily called with:', { userId, userInfo, dailyLimit });
  
  // Use Vietnam timezone instead of UTC
  const { getVietnamDate } = require('../utils/timezone');
  const today = getVietnamDate();
  
  console.log('Today (Vietnam):', today);
  
  let usage = await this.findOne({ userId, date: today });
  
  if (!usage) {
    console.log('Creating new daily usage record');
    usage = new this({
      userId,
      username: userInfo.username,
      email: userInfo.email,
      date: today,
      dailyLimit,
      subscriptionType: userInfo.subscriptionType || 'free',
      moduleUsage: [],
      requestHistory: [],
      warningsIssued: []
    });
    await usage.save();
    console.log('New daily usage record saved');
  } else {
    console.log('Found existing daily usage record');
  }
  
  // Update daily limit if it changed (due to subscription changes, etc.)
  if (usage.dailyLimit !== dailyLimit) {
    usage.dailyLimit = dailyLimit;
    await usage.save();
  }
  
  return usage;
};

// Static method to get usage statistics
DailyUsageLimitSchema.statics.getUsageStats = async function(startDate, endDate) {
  const pipeline = [
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          date: '$date',
          subscriptionType: '$subscriptionType'
        },
        totalUsers: { $sum: 1 },
        totalUsage: { $sum: '$totalUsage' },
        avgUsage: { $avg: '$totalUsage' },
        blockedUsers: { $sum: { $cond: ['$isBlocked', 1, 0] } },
        exceededLimitUsers: { 
          $sum: { 
            $cond: [{ $gte: ['$totalUsage', '$dailyLimit'] }, 1, 0] 
          } 
        }
      }
    },
    {
      $sort: { '_id.date': -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to get heavy users (potential account sharers)
DailyUsageLimitSchema.statics.getHeavyUsers = async function(days = 7, usageThreshold = 0.9) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  const pipeline = [
    {
      $match: {
        date: { $gte: startDateStr }
      }
    },
    {
      $group: {
        _id: '$userId',
        username: { $first: '$username' },
        email: { $first: '$email' },
        subscriptionType: { $first: '$subscriptionType' },
        avgUsagePercentage: { 
          $avg: { 
            $cond: [
              { $gt: ['$dailyLimit', 0] },
              { $divide: ['$totalUsage', '$dailyLimit'] },
              0
            ]
          }
        },
        totalDays: { $sum: 1 },
        totalUsage: { $sum: '$totalUsage' },
        daysExceededLimit: { 
          $sum: { 
            $cond: [{ $gte: ['$totalUsage', '$dailyLimit'] }, 1, 0] 
          } 
        }
      }
    },
    {
      $match: {
        avgUsagePercentage: { $gte: usageThreshold }
      }
    },
    {
      $sort: { avgUsagePercentage: -1 }
    }
  ];
  
  return this.aggregate(pipeline);
};

// Method to cleanup old records
DailyUsageLimitSchema.statics.cleanupOldRecords = async function(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  return this.deleteMany({ date: { $lt: cutoffDateStr } });
};

module.exports = mongoose.model('DailyUsageLimit', DailyUsageLimitSchema);