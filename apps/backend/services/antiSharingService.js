const DeviceFingerprint = require('../models/DeviceFingerprint');
const UserSession = require('../models/UserSession');
const AccountBlock = require('../models/AccountBlock');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

/**
 * Anti-Sharing Detection Service
 * Hybrid approach combining hardware fingerprinting, behavioral analysis, and session management
 */
class AntiSharingService {
  constructor() {
    this.SCORING_WEIGHTS = {
      hardware: 0.35,      // Hardware fingerprint violations
      behavior: 0.40,      // Behavioral pattern analysis  
      session: 0.25        // Session management violations
    };

    this.BLOCK_THRESHOLDS = {
      SUSPICIOUS: 60,      // Start monitoring
      LIKELY_SHARING: 75,  // Restrict features
      CONFIRMED_SHARING: 85 // Block account
    };

    // Start background processes
    this.startBackgroundProcesses();
  }

  /**
   * Main entry point - check if user session should be allowed
   */
  async validateUserSession(userId, sessionData) {
    try {
      console.log(`🔍 Anti-sharing check for user: ${userId}`);

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is currently blocked
      const existingBlock = await this.checkExistingBlock(userId);
      if (existingBlock) {
        return {
          allowed: false,
          reason: 'ACCOUNT_BLOCKED',
          blockInfo: existingBlock,
          action: 'BLOCK_USER'
        };
      }

      // Register/update device fingerprint
      const deviceCheck = await this.processDeviceFingerprint(userId, user.username, sessionData);
      
      // Create or update user session
      const sessionCheck = await this.processUserSession(userId, user.username, sessionData, deviceCheck.deviceId);

      // Calculate sharing score
      const sharingScore = await this.calculateSharingScore(userId, deviceCheck, sessionCheck);

      // Determine action based on score
      const action = await this.determineAction(userId, user.username, sharingScore, deviceCheck, sessionCheck);

      console.log(`📊 Sharing score for ${user.username}: ${sharingScore.total}/100 - Action: ${action.action}`);

      return {
        allowed: action.action !== 'BLOCK_USER',
        sharingScore: sharingScore.total,
        scoreBreakdown: sharingScore,
        deviceInfo: deviceCheck,
        sessionInfo: sessionCheck,
        action: action.action,
        reason: action.reason,
        blockInfo: action.blockInfo
      };

    } catch (error) {
      console.error('❌ Anti-sharing validation error:', error);
      // In case of error, allow user but log incident
      await createAuditLog('ANTI_SHARING_ERROR', `Validation error for user ${userId}: ${error.message}`);
      
      return {
        allowed: true,
        error: error.message,
        fallback: true
      };
    }
  }

  /**
   * Process device fingerprint
   */
  async processDeviceFingerprint(userId, username, sessionData) {
    const { fingerprint, deviceInfo, ipAddress } = sessionData;

    // Check if device already exists
    let device = await DeviceFingerprint.findOne({
      userId,
      fingerprint,
      isActive: true
    });

    if (device) {
      // Update existing device
      device.lastSeen = new Date();
      device.sessionCount += 1;
      device.ipAddress = ipAddress;
      await device.save();

      console.log(`📱 Known device for ${username}: ${device.deviceName || 'Unnamed'}`);
    } else {
      // Check device limits
      const subscriptionType = await this.getUserSubscriptionType(userId);
      const deviceLimit = DeviceFingerprint.getDeviceLimits(subscriptionType);
      const activeDevices = await DeviceFingerprint.countDocuments({
        userId,
        isActive: true
      });

      if (activeDevices >= deviceLimit) {
        console.log(`⚠️ Device limit exceeded for ${username}: ${activeDevices}/${deviceLimit}`);
        
        // Optionally deactivate oldest device
        const oldestDevice = await DeviceFingerprint.findOne({
          userId,
          isActive: true
        }).sort({ lastSeen: 1 });

        if (oldestDevice) {
          oldestDevice.isActive = false;
          await oldestDevice.save();
          console.log(`🗑️ Deactivated oldest device for ${username}`);
        }
      }

      // Create new device
      device = await DeviceFingerprint.create({
        userId,
        username,
        fingerprint,
        deviceInfo,
        ipAddress,
        deviceName: this.generateDeviceName(deviceInfo)
      });

      console.log(`✨ New device registered for ${username}: ${device.deviceName}`);
    }

    // Check for suspicious device activity
    const deviceSuspicion = await this.analyzeDeviceSuspicion(device);

    return {
      deviceId: device._id,
      device,
      isNewDevice: !device.sessionCount || device.sessionCount <= 1,
      suspicionScore: deviceSuspicion.score,
      suspicionReasons: deviceSuspicion.reasons,
      deviceLimit: {
        current: await DeviceFingerprint.countDocuments({ userId, isActive: true }),
        maximum: DeviceFingerprint.getDeviceLimits(await this.getUserSubscriptionType(userId))
      }
    };
  }

  /**
   * Process user session
   */
  async processUserSession(userId, username, sessionData, deviceFingerprintId) {
    const { sessionToken, ipAddress, userAgent } = sessionData;

    // Check concurrent session limits
    const subscriptionType = await this.getUserSubscriptionType(userId);
    const sessionLimit = await UserSession.checkConcurrentLimit(userId, subscriptionType);

    if (sessionLimit.exceeded) {
      console.log(`⚠️ Session limit exceeded for ${username}: ${sessionLimit.current}/${sessionLimit.limit}`);
      
      // Force logout oldest sessions
      const loggedOut = await UserSession.forceLogoutOldest(userId, sessionLimit.limit - 1);
      console.log(`🚪 Forced logout ${loggedOut} old sessions for ${username}`);
    }

    // Create new session
    const session = await UserSession.create({
      userId,
      username,
      sessionToken,
      deviceFingerprintId,
      ipAddress,
      userAgent
    });

    // Analyze session patterns
    const sessionSuspicion = await this.analyzeSessionSuspicion(userId, session);

    return {
      sessionId: session._id,
      session,
      concurrentSessions: sessionLimit.current,
      sessionLimit: sessionLimit.limit,
      suspicionScore: sessionSuspicion.score,
      suspicionReasons: sessionSuspicion.reasons
    };
  }

  /**
   * Calculate overall sharing score
   */
  async calculateSharingScore(userId, deviceCheck, sessionCheck) {
    // Hardware score (0-100)
    const hardwareScore = Math.min(100, 
      deviceCheck.suspicionScore + 
      (deviceCheck.deviceLimit.current > deviceCheck.deviceLimit.maximum ? 30 : 0) +
      (deviceCheck.isNewDevice ? 10 : 0)
    );

    // Session score (0-100)  
    const sessionScore = Math.min(100,
      sessionCheck.suspicionScore +
      (sessionCheck.concurrentSessions > sessionCheck.sessionLimit ? 40 : 0)
    );

    // Behavioral score (simplified for now - will enhance later)
    const behaviorScore = await this.calculateBehaviorScore(userId);

    // Calculate weighted total
    const total = Math.round(
      hardwareScore * this.SCORING_WEIGHTS.hardware +
      behaviorScore * this.SCORING_WEIGHTS.behavior +
      sessionScore * this.SCORING_WEIGHTS.session
    );

    return {
      total,
      hardware: hardwareScore,
      behavior: behaviorScore,
      session: sessionScore,
      breakdown: {
        deviceSuspicion: deviceCheck.suspicionScore,
        deviceLimitViolation: deviceCheck.deviceLimit.current > deviceCheck.deviceLimit.maximum,
        newDevice: deviceCheck.isNewDevice,
        sessionSuspicion: sessionCheck.suspicionScore,
        sessionLimitViolation: sessionCheck.concurrentSessions > sessionCheck.sessionLimit
      }
    };
  }

  /**
   * Determine action based on sharing score
   */
  async determineAction(userId, username, sharingScore, deviceCheck, sessionCheck) {
    const score = sharingScore.total;

    if (score >= this.BLOCK_THRESHOLDS.CONFIRMED_SHARING) {
      // Create account block
      const blockInfo = await AccountBlock.createBlock(
        userId,
        username,
        'ACCOUNT_SHARING_DETECTED',
        score,
        {
          concurrentSessions: sessionCheck.concurrentSessions,
          deviceCount: deviceCheck.deviceLimit.current,
          suspiciousPatterns: [
            ...deviceCheck.suspicionReasons,
            ...sessionCheck.suspicionReasons
          ]
        }
      );

      // Deactivate user
      await User.findByIdAndUpdate(userId, { isActive: false });
      
      await createAuditLog('ACCOUNT_BLOCKED', 
        `User ${username} blocked for account sharing (score: ${score})`
      );

      return {
        action: 'BLOCK_USER',
        reason: 'CONFIRMED_ACCOUNT_SHARING',
        blockInfo
      };

    } else if (score >= this.BLOCK_THRESHOLDS.LIKELY_SHARING) {
      // Restrict features but don't block completely
      await createAuditLog('ACCOUNT_RESTRICTED', 
        `User ${username} restricted due to likely sharing (score: ${score})`
      );

      return {
        action: 'RESTRICT_FEATURES',
        reason: 'LIKELY_ACCOUNT_SHARING',
        restrictions: ['REDUCED_RATE_LIMITS', 'SINGLE_DEVICE_ONLY', 'ENHANCED_MONITORING']
      };

    } else if (score >= this.BLOCK_THRESHOLDS.SUSPICIOUS) {
      // Enhanced monitoring
      await createAuditLog('ACCOUNT_MONITORED', 
        `User ${username} flagged for enhanced monitoring (score: ${score})`
      );

      return {
        action: 'ENHANCED_MONITORING',
        reason: 'SUSPICIOUS_ACTIVITY',
        monitoring: ['TRACK_ALL_SESSIONS', 'LOG_DEVICE_CHANGES', 'BEHAVIOR_ANALYSIS']
      };

    } else {
      // Normal operation
      return {
        action: 'ALLOW',
        reason: 'NORMAL_USAGE'
      };
    }
  }

  /**
   * Check if user has existing active block
   */
  async checkExistingBlock(userId) {
    const activeBlock = await AccountBlock.findOne({
      userId,
      status: 'ACTIVE'
    });

    if (activeBlock && activeBlock.isExpired()) {
      // Auto-unblock expired block
      activeBlock.status = 'EXPIRED';
      activeBlock.adminActions.push({
        adminUser: 'SYSTEM',
        action: 'UNBLOCKED',
        notes: 'Auto-unblocked due to expiration'
      });
      await activeBlock.save();

      // Reactivate user
      await User.findByIdAndUpdate(userId, { isActive: true });
      
      console.log(`🔓 Auto-unblocked expired block for user: ${userId}`);
      return null;
    }

    return activeBlock;
  }

  /**
   * Analyze device for suspicious patterns
   */
  async analyzeDeviceSuspicion(device) {
    let score = 0;
    const reasons = [];

    // Check for rapid location changes
    const recentSessions = await UserSession.find({
      deviceFingerprintId: device._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 }).limit(5);

    if (recentSessions.length >= 2) {
      const locationChanges = this.countLocationChanges(recentSessions);
      if (locationChanges >= 3) {
        score += 40;
        reasons.push('RAPID_LOCATION_CHANGES');
      }
    }

    // Check session frequency
    if (device.sessionCount > 50) {
      score += 20;
      reasons.push('HIGH_SESSION_FREQUENCY');
    }

    return { score, reasons };
  }

  /**
   * Analyze session for suspicious patterns
   */
  async analyzeSessionSuspicion(userId, session) {
    let score = 0;
    const reasons = [];

    // Check for simultaneous sessions from different IPs
    const concurrentSessions = await UserSession.find({
      userId,
      isActive: true,
      _id: { $ne: session._id }
    });

    const differentIPs = new Set(concurrentSessions.map(s => s.ipAddress));
    if (differentIPs.size >= 2) {
      score += 50;
      reasons.push('MULTIPLE_SIMULTANEOUS_IPS');
    }

    // Check for unusual timing patterns
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 5) { // 2-5 AM unusual activity
      score += 15;
      reasons.push('UNUSUAL_TIMING');
    }

    return { score, reasons };
  }

  /**
   * Calculate behavioral score (placeholder for AI implementation)
   */
  async calculateBehaviorScore(userId) {
    // This will be enhanced with AI behavioral analysis
    // For now, return baseline score
    const user = await User.findById(userId);
    const baseScore = 20;
    
    // Check account age
    const accountAge = Date.now() - user.createdAt.getTime();
    const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreation < 1) {
      return baseScore + 30; // New accounts are more suspicious
    } else if (daysSinceCreation < 7) {
      return baseScore + 15;
    }
    
    return baseScore;
  }

  /**
   * Helper methods
   */
  async getUserSubscriptionType(userId) {
    const user = await User.findById(userId);
    return user?.subscriptionType || 'free';
  }

  generateDeviceName(deviceInfo) {
    const { browser = {}, system = {} } = deviceInfo;
    const browserName = browser.userAgent?.includes('Chrome') ? 'Chrome' :
                       browser.userAgent?.includes('Firefox') ? 'Firefox' :
                       browser.userAgent?.includes('Safari') ? 'Safari' : 'Browser';
    
    const platform = system.platform || browser.platform || 'Unknown';
    return `${browserName} on ${platform}`;
  }

  countLocationChanges(sessions) {
    const uniqueIPs = new Set(sessions.map(s => s.ipAddress));
    return uniqueIPs.size;
  }

  /**
   * Background processes
   */
  startBackgroundProcesses() {
    // Process expired blocks every 5 minutes
    setInterval(async () => {
      try {
        await AccountBlock.processExpiredBlocks();
      } catch (error) {
        console.error('Error processing expired blocks:', error);
      }
    }, 5 * 60 * 1000);

    // Clean up old sessions every hour
    setInterval(async () => {
      try {
        const result = await UserSession.deleteMany({
          isActive: false,
          updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        console.log(`🧹 Cleaned up ${result.deletedCount} old sessions`);
      } catch (error) {
        console.error('Error cleaning up sessions:', error);
      }
    }, 60 * 60 * 1000);

    console.log('🚀 Anti-sharing background processes started');
  }
}

// Export singleton instance
const antiSharingService = new AntiSharingService();
module.exports = antiSharingService;