const mongoose = require('mongoose');

const accountBlockSchema = new mongoose.Schema({
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
  blockType: {
    type: String,
    enum: ['TEMPORARY', 'PERMANENT', 'RESTRICTED'],
    default: 'TEMPORARY',
    index: true
  },
  blockReason: {
    type: String,
    enum: [
      'ACCOUNT_SHARING_DETECTED',
      'SUSPICIOUS_ACTIVITY', 
      'MULTIPLE_DEVICE_VIOLATION',
      'BEHAVIORAL_ANOMALY',
      'MANUAL_ADMIN_ACTION',
      'APPEAL_REJECTED'
    ],
    required: true
  },
  blockLevel: {
    type: String,
    enum: ['FULL_BLOCK', 'LIMITED_ACCESS', 'RESTRICTED_FEATURES'],
    default: 'FULL_BLOCK'
  },
  
  // Scoring info
  sharingScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  scoreBreakdown: {
    hardwareScore: { type: Number, default: 0 },
    behaviorScore: { type: Number, default: 0 },
    sessionScore: { type: Number, default: 0 }
  },
  
  // Block duration
  blockedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  blockedUntil: {
    type: Date,
    index: true
  },
  
  // Block status
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'APPEALED', 'UNBLOCKED', 'ESCALATED'],
    default: 'ACTIVE',
    index: true
  },
  
  // Evidence and context
  evidence: {
    concurrentSessions: { type: Number, default: 0 },
    deviceCount: { type: Number, default: 0 },
    locationChanges: { type: Number, default: 0 },
    ipAddresses: [{ type: String }],
    suspiciousPatterns: [{ type: String }]
  },
  
  // Appeal information
  appealInfo: {
    appealedAt: { type: Date },
    appealReason: { type: String },
    appealEvidence: { type: String },
    appealStatus: {
      type: String,
      enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'],
      default: 'NONE'
    },
    reviewedBy: { type: String }, // Admin username
    reviewedAt: { type: Date },
    reviewNotes: { type: String }
  },
  
  // Auto-unblock attempts
  autoUnblockAttempts: [{
    attemptedAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ['EMAIL_SMS_VERIFY', 'DEVICE_REREGISTER', 'BEHAVIOR_CHECK', 'TIME_EXPIRED']
    },
    success: { type: Boolean, default: false },
    failureReason: { type: String }
  }],
  
  // Admin actions
  adminActions: [{
    actionAt: { type: Date, default: Date.now },
    adminUser: { type: String },
    action: {
      type: String,
      enum: ['BLOCK_CREATED', 'BLOCK_EXTENDED', 'BLOCK_REDUCED', 'UNBLOCKED', 'APPEAL_REVIEWED']
    },
    notes: { type: String }
  }]
}, { 
  timestamps: true 
});

// Indexes
accountBlockSchema.index({ userId: 1, status: 1 });
accountBlockSchema.index({ blockedUntil: 1, status: 1 });
accountBlockSchema.index({ 'appealInfo.appealStatus': 1 });

// Auto-expire temporary blocks
accountBlockSchema.pre('save', function(next) {
  if (this.blockType === 'TEMPORARY' && this.blockedUntil && new Date() > this.blockedUntil) {
    this.status = 'EXPIRED';
  }
  next();
});

// Static method to create block with auto-calculated duration
accountBlockSchema.statics.createBlock = async function(userId, username, reason, sharingScore, evidence = {}) {
  // Calculate block duration based on score and history
  const previousBlocks = await this.countDocuments({
    userId,
    status: { $in: ['ACTIVE', 'EXPIRED'] }
  });
  
  let blockDuration;
  if (sharingScore >= 90) {
    blockDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
  } else if (sharingScore >= 80) {
    blockDuration = 24 * 60 * 60 * 1000; // 24 hours
  } else if (sharingScore >= 70) {
    blockDuration = 6 * 60 * 60 * 1000; // 6 hours
  } else {
    blockDuration = 1 * 60 * 60 * 1000; // 1 hour
  }
  
  // Increase duration for repeat offenders
  blockDuration *= Math.pow(2, previousBlocks);
  
  const blockedUntil = new Date(Date.now() + blockDuration);
  
  const blockData = {
    userId,
    username,
    blockReason: reason,
    sharingScore,
    evidence,
    blockedUntil,
    adminActions: [{
      adminUser: 'SYSTEM',
      action: 'BLOCK_CREATED',
      notes: `Auto-block created with score ${sharingScore}. Previous blocks: ${previousBlocks}`
    }]
  };
  
  return await this.create(blockData);
};

// Instance method to check if block is expired
accountBlockSchema.methods.isExpired = function() {
  return this.blockType === 'TEMPORARY' && 
         this.blockedUntil && 
         new Date() > this.blockedUntil;
};

// Instance method to get remaining time
accountBlockSchema.methods.getRemainingTime = function() {
  if (!this.blockedUntil || this.isExpired()) return 0;
  return this.blockedUntil.getTime() - Date.now();
};

// Static method to auto-unblock expired blocks
accountBlockSchema.statics.processExpiredBlocks = async function() {
  const expiredBlocks = await this.find({
    status: 'ACTIVE',
    blockType: 'TEMPORARY',
    blockedUntil: { $lt: new Date() }
  });
  
  const unblockPromises = expiredBlocks.map(async (block) => {
    block.status = 'EXPIRED';
    
    // Add admin action for auto-unblock
    block.adminActions.push({
      adminUser: 'SYSTEM',
      action: 'UNBLOCKED',
      notes: 'Auto-unblocked due to expiration'
    });
    
    await block.save();
    
    // Update user status
    const User = mongoose.model('User');
    await User.findByIdAndUpdate(block.userId, {
      isActive: true
    });
    
    return block;
  });
  
  const processed = await Promise.all(unblockPromises);
  console.log(`🔓 Auto-unblocked ${processed.length} expired accounts`);
  
  return processed;
};

module.exports = mongoose.model('AccountBlock', accountBlockSchema);