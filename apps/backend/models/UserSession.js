const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // jwtToken: {
  //   type: String,
  //   required: false,  // Optional field for JWT token reference
  //   index: true
  // },
  deviceFingerprintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceFingerprint',
    required: false // Made optional for simple login without device fingerprinting
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  userAgent: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  loginAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  logoutAt: {
    type: Date,
    index: true
  },
  logoutReason: {
    type: String,
    enum: ['USER_LOGOUT', 'FORCE_LOGOUT', 'SESSION_EXPIRED', 'DEVICE_LIMIT', 'SUSPICIOUS_ACTIVITY'],
    default: 'USER_LOGOUT'
  },
  // Behavioral tracking
  activityMetrics: {
    totalApiCalls: { type: Number, default: 0 },
    totalTimeActive: { type: Number, default: 0 }, // milliseconds
    avgResponseTime: { type: Number, default: 0 },
    featuresUsed: [{ type: String }],
    errorCount: { type: Number, default: 0 }
  },
  // Geographic tracking
  locations: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    country: String,
    city: String,
    latitude: Number,
    longitude: Number
  }],
  // Security metrics
  securityFlags: {
    rapidLocationChange: { type: Boolean, default: false },
    suspiciousTiming: { type: Boolean, default: false },
    unusualBehavior: { type: Boolean, default: false },
    concurrentSessions: { type: Boolean, default: false }
  }
}, { 
  timestamps: true,
  // Auto-expire sessions after 7 days of inactivity
  expireAfterSeconds: 7 * 24 * 60 * 60
});

// Indexes for efficient queries
userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ sessionToken: 1, isActive: 1 });
userSessionSchema.index({ lastActivity: 1 });
userSessionSchema.index({ loginAt: -1 });

// Update lastActivity on save
userSessionSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('activityMetrics')) {
    this.lastActivity = new Date();
  }
  next();
});

// Static method to check concurrent sessions
userSessionSchema.statics.checkConcurrentLimit = async function(userId, subscriptionType) {
  const limits = {
    'free': 1,
    'monthly': 2,
    'lifetime': 3
  };
  
  const maxSessions = limits[subscriptionType] || 1;
  const activeSessions = await this.countDocuments({
    userId,
    isActive: true
  });
  
  return {
    current: activeSessions,
    limit: maxSessions,
    exceeded: activeSessions >= maxSessions
  };
};

// Static method to force logout oldest sessions
userSessionSchema.statics.forceLogoutOldest = async function(userId, keepCount = 1) {
  const oldestSessions = await this.find({
    userId,
    isActive: true
  })
  .sort({ lastActivity: 1 })
  .skip(keepCount);
  
  const logoutPromises = oldestSessions.map(session => {
    session.isActive = false;
    session.logoutAt = new Date();
    session.logoutReason = 'DEVICE_LIMIT';
    return session.save();
  });
  
  await Promise.all(logoutPromises);
  return oldestSessions.length;
};

// Instance method to calculate session score
userSessionSchema.methods.calculateBehaviorScore = function() {
  const metrics = this.activityMetrics;
  const flags = this.securityFlags;
  
  let score = 50; // Base score
  
  // Positive indicators
  if (metrics.totalApiCalls > 10) score += 10;
  if (metrics.totalTimeActive > 30 * 60 * 1000) score += 10; // 30+ minutes
  if (metrics.errorCount < 5) score += 5;
  
  // Negative indicators
  if (flags.rapidLocationChange) score -= 30;
  if (flags.suspiciousTiming) score -= 20;
  if (flags.unusualBehavior) score -= 25;
  if (flags.concurrentSessions) score -= 15;
  
  return Math.max(0, Math.min(100, score));
};

module.exports = mongoose.model('UserSession', userSessionSchema);