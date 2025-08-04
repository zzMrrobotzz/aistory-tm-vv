const mongoose = require('mongoose');

const RateLimitConfigSchema = new mongoose.Schema({
  // General rate limiting settings
  isEnabled: {
    type: Boolean,
    default: true
  },
  dailyLimit: {
    type: Number,
    default: 200,
    min: 1,
    max: 10000
  },
  resetTime: {
    type: String,
    default: '00:00', // Reset at midnight
    validate: {
      validator: function(v) {
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Reset time must be in HH:mm format'
    }
  },
  timezone: {
    type: String,
    default: 'Asia/Ho_Chi_Minh'
  },
  
  // Module-specific settings
  restrictedModules: [{
    moduleId: {
      type: String,
      required: true,
      enum: ['write-story', 'batch-story-writing', 'rewrite', 'batch-rewrite']
    },
    moduleName: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    weight: {
      type: Number,
      default: 1, // Each request counts as 1 toward daily limit
      min: 0.1,
      max: 10
    }
  }],
  
  // Exemption settings
  exemptedUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    exemptionReason: {
      type: String,
      default: 'Admin exemption'
    },
    exemptedAt: {
      type: Date,
      default: Date.now
    },
    exemptedBy: {
      type: String,
      default: 'system'
    }
  }],
  
  // Subscription-based limits
  subscriptionLimits: [{
    subscriptionType: {
      type: String,
      enum: ['free', 'monthly', 'quarterly', 'lifetime'],
      required: true
    },
    dailyLimit: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String
    }
  }],
  
  // Burst settings (allow short bursts above daily limit)
  burstSettings: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    burstLimit: {
      type: Number,
      default: 20 // Allow 20 extra requests in burst
    },
    burstWindowMinutes: {
      type: Number,
      default: 60 // Within 1 hour window
    },
    cooldownMinutes: {
      type: Number,
      default: 240 // 4 hour cooldown after burst
    }
  },
  
  // Warning thresholds
  warningThresholds: [{
    percentage: {
      type: Number,
      min: 1,
      max: 100,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // Override settings for special cases
  overrideSettings: {
    weekendMultiplier: {
      type: Number,
      default: 1.0, // No change on weekends
      min: 0.1,
      max: 5.0
    },
    holidayMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.1,
      max: 5.0
    },
    maintenanceMode: {
      isEnabled: {
        type: Boolean,
        default: false
      },
      allowedLimit: {
        type: Number,
        default: 0 // No requests during maintenance
      },
      message: {
        type: String,
        default: 'System is under maintenance. Please try again later.'
      }
    }
  },
  
  // Monitoring and logging
  monitoringSettings: {
    logAllRequests: {
      type: Boolean,
      default: true
    },
    alertOnHighUsage: {
      type: Boolean,
      default: true
    },
    highUsageThreshold: {
      type: Number,
      default: 150 // Alert when user reaches 150 requests
    },
    retentionDays: {
      type: Number,
      default: 30 // Keep usage logs for 30 days
    }
  },
  
  // Meta information
  lastUpdatedBy: {
    type: String,
    default: 'system'
  },
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create indexes for better performance
RateLimitConfigSchema.index({ isActive: 1 });
RateLimitConfigSchema.index({ 'restrictedModules.moduleId': 1 });
RateLimitConfigSchema.index({ 'exemptedUsers.userId': 1 });
RateLimitConfigSchema.index({ 'subscriptionLimits.subscriptionType': 1 });

// Method to get effective daily limit for a user
RateLimitConfigSchema.methods.getEffectiveDailyLimit = function(user) {
  // Check if user is exempted
  const exemption = this.exemptedUsers.find(exempt => 
    exempt.userId.toString() === user._id.toString()
  );
  if (exemption) {
    return Infinity; // No limit for exempted users
  }
  
  // Check subscription-based limits
  const subscriptionLimit = this.subscriptionLimits.find(limit => 
    limit.subscriptionType === user.subscriptionType
  );
  if (subscriptionLimit) {
    return subscriptionLimit.dailyLimit;
  }
  
  // Apply weekend/holiday multipliers
  const now = new Date();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  let effectiveLimit = this.dailyLimit;
  
  if (isWeekend) {
    effectiveLimit *= this.overrideSettings.weekendMultiplier;
  }
  
  return Math.floor(effectiveLimit);
};

// Method to get active restricted modules
RateLimitConfigSchema.methods.getActiveRestrictedModules = function() {
  return this.restrictedModules.filter(module => module.isActive);
};

// Method to get warning message for usage percentage
RateLimitConfigSchema.methods.getWarningMessage = function(usagePercentage) {
  const activeWarnings = this.warningThresholds
    .filter(warning => warning.isActive)
    .sort((a, b) => b.percentage - a.percentage);
  
  for (const warning of activeWarnings) {
    if (usagePercentage >= warning.percentage) {
      return warning.message;
    }
  }
  
  return null;
};

// Static method to get or create default configuration
RateLimitConfigSchema.statics.getDefault = async function() {
  let config = await this.findOne({ isActive: true });
  
  if (!config) {
    // Create default configuration
    config = new this({
      // Default restricted modules
      restrictedModules: [
        {
          moduleId: 'write-story',
          moduleName: 'Viết Truyện Đơn',
          isActive: true,
          weight: 1
        },
        {
          moduleId: 'batch-story-writing',
          moduleName: 'Viết Truyện Hàng Loạt',
          isActive: true,
          weight: 2 // Batch operations count more
        },
        {
          moduleId: 'rewrite',
          moduleName: 'Viết Lại Đơn',
          isActive: true,
          weight: 1
        },
        {
          moduleId: 'batch-rewrite',
          moduleName: 'Viết Lại Hàng Loạt',
          isActive: true,
          weight: 2 // Batch operations count more
        }
      ],
      
      // Default subscription limits
      subscriptionLimits: [
        {
          subscriptionType: 'free',
          dailyLimit: 50,
          description: 'Free tier - limited usage to encourage upgrades'
        },
        {
          subscriptionType: 'monthly',
          dailyLimit: 200,
          description: 'Monthly subscription - standard daily limit'
        },
        {
          subscriptionType: 'quarterly',
          dailyLimit: 300,
          description: 'Quarterly subscription - increased daily limit'
        },
        {
          subscriptionType: 'lifetime',
          dailyLimit: 500,
          description: 'Lifetime subscription - highest daily limit'
        }
      ],
      
      // Default warning thresholds
      warningThresholds: [
        {
          percentage: 50,
          message: 'Bạn đã sử dụng 50% quota hàng ngày. Hãy cân nhắc việc sử dụng hợp lý.',
          isActive: true
        },
        {
          percentage: 75,
          message: 'Bạn đã sử dụng 75% quota hàng ngày. Chỉ còn 25% cho hôm nay.',
          isActive: true
        },
        {
          percentage: 90,
          message: 'Cảnh báo: Bạn đã sử dụng 90% quota hàng ngày. Hãy sử dụng cẩn thận!',
          isActive: true
        }
      ]
    });
    
    await config.save();
  }
  
  return config;
};

// Method to check if a module is restricted
RateLimitConfigSchema.methods.isModuleRestricted = function(moduleId) {
  const module = this.restrictedModules.find(m => m.moduleId === moduleId);
  return module && module.isActive;
};

// Method to get module weight
RateLimitConfigSchema.methods.getModuleWeight = function(moduleId) {
  const module = this.restrictedModules.find(m => m.moduleId === moduleId);
  return module ? module.weight : 1;
};

module.exports = mongoose.model('RateLimitConfig', RateLimitConfigSchema);