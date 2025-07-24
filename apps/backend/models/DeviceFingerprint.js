const mongoose = require('mongoose');

const deviceFingerprintSchema = new mongoose.Schema({
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
  fingerprint: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceInfo: {
    // Hardware info
    gpu: { type: String, default: '' },
    cpu: { type: Number, default: 0 }, // navigator.hardwareConcurrency
    memory: { type: Number, default: 0 }, // navigator.deviceMemory
    screen: { type: String, default: '' }, // "1920x1080x24"
    
    // Browser info
    userAgent: { type: String, default: '' },
    browser: { type: String, default: '' },
    browserVersion: { type: String, default: '' },
    os: { type: String, default: '' },
    platform: { type: String, default: '' },
    
    // Advanced fingerprints
    canvasFingerprint: { type: String, default: '' },
    webglFingerprint: { type: String, default: '' },
    audioFingerprint: { type: String, default: '' },
    fontFingerprint: { type: String, default: '' },
    
    // Location & network
    timezone: { type: String, default: '' },
    language: { type: String, default: '' },
    cookiesEnabled: { type: Boolean, default: true },
    doNotTrack: { type: String, default: '' }
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  ipInfo: {
    country: { type: String, default: '' },
    region: { type: String, default: '' },
    city: { type: String, default: '' },
    isp: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false // Admin có thể verify device nào là legitimate
  },
  deviceName: {
    type: String,
    default: '' // User có thể đặt tên device: "MacBook Pro", "iPhone của Anh"
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  sessionCount: {
    type: Number,
    default: 0
  },
  // Anti-sharing metrics
  suspiciousActivity: {
    rapidLocationChanges: { type: Number, default: 0 },
    unusualUsageHours: { type: Number, default: 0 },
    simultaneousActivity: { type: Number, default: 0 }
  }
}, { 
  timestamps: true 
});

// Indexes for performance
deviceFingerprintSchema.index({ userId: 1, isActive: 1 });
deviceFingerprintSchema.index({ fingerprint: 1, isActive: 1 });
deviceFingerprintSchema.index({ ipAddress: 1, createdAt: -1 });

// Auto-update lastSeen on save
deviceFingerprintSchema.pre('save', function(next) {
  if (this.isModified('isActive') && this.isActive) {
    this.lastSeen = new Date();
    this.sessionCount += 1;
  }
  next();
});

// Static method to get device limits by subscription
deviceFingerprintSchema.statics.getDeviceLimits = function(subscriptionType) {
  const limits = {
    'free': 1,
    'monthly': 2,
    'lifetime': 3,
    'trial_1days': 1,
    'trial_3days': 1,
    'trial_7days': 2,
    'trial_15days': 2,
    'trial_30days': 2
  };
  
  return limits[subscriptionType] || 1;
};

// Instance method to check if device is suspicious
deviceFingerprintSchema.methods.getSuspiciousScore = function() {
  const activity = this.suspiciousActivity;
  return (
    activity.rapidLocationChanges * 30 +
    activity.unusualUsageHours * 20 +
    activity.simultaneousActivity * 50
  );
};

module.exports = mongoose.model('DeviceFingerprint', deviceFingerprintSchema);