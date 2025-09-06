const mongoose = require('mongoose');

const FeatureUsageSchema = new mongoose.Schema({
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
  date: {
    type: String, // YYYY-MM-DD format
    required: true,
    index: true
  },
  totalUses: {
    type: Number,
    default: 0,
    min: 0
  },
  dailyLimit: {
    type: Number,
    default: 300, // 300 feature uses per day
    min: 1
  },
  subscriptionType: {
    type: String,
    enum: ['free', 'monthly', 'lifetime'],
    default: 'free'
  },
  featureBreakdown: [{
    featureId: {
      type: String,
      required: true
    },
    featureName: {
      type: String,
      required: true
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  usageHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    featureId: {
      type: String,
      required: true
    },
    featureName: String,
    success: {
      type: Boolean,
      default: true
    }
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
FeatureUsageSchema.index({ userId: 1, date: 1 }, { unique: true });

// Pre-save middleware to update lastActivity
FeatureUsageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  this.lastActivity = new Date();
  next();
});

// Helper method to check if user can use feature
FeatureUsageSchema.methods.canUseFeature = function() {
  return this.totalUses < this.dailyLimit;
};

// Helper method to track feature usage
FeatureUsageSchema.methods.trackFeatureUsage = function(featureId, featureName) {
  if (!this.canUseFeature()) {
    return false;
  }
  
  // Increment total uses
  this.totalUses += 1;
  
  // Update feature breakdown
  const existingFeature = this.featureBreakdown.find(f => f.featureId === featureId);
  if (existingFeature) {
    existingFeature.usageCount += 1;
    existingFeature.lastUsed = new Date();
  } else {
    this.featureBreakdown.push({
      featureId,
      featureName,
      usageCount: 1,
      lastUsed: new Date()
    });
  }
  
  // Add to usage history
  this.usageHistory.push({
    timestamp: new Date(),
    featureId,
    featureName,
    success: true
  });
  
  // Keep only last 100 history entries
  if (this.usageHistory.length > 100) {
    this.usageHistory = this.usageHistory.slice(-100);
  }
  
  return true;
};

// Helper method to get usage stats
FeatureUsageSchema.methods.getUsageStats = function() {
  const remaining = Math.max(0, this.dailyLimit - this.totalUses);
  const percentage = this.dailyLimit > 0 ? Math.round((this.totalUses / this.dailyLimit) * 100) : 0;
  
  return {
    current: this.totalUses,
    dailyLimit: this.dailyLimit,
    remaining,
    percentage,
    isBlocked: this.totalUses >= this.dailyLimit,
    featureBreakdown: this.featureBreakdown.map(f => ({
      featureId: f.featureId,
      featureName: f.featureName,
      usageCount: f.usageCount,
      lastUsed: f.lastUsed
    })),
    lastActivity: this.lastActivity
  };
};

module.exports = mongoose.model('FeatureUsage', FeatureUsageSchema);