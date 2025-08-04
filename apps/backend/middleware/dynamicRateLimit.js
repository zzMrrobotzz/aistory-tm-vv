const RateLimitConfig = require('../models/RateLimitConfig');
const DailyUsageLimit = require('../models/DailyUsageLimit');

/**
 * Dynamic rate limiting middleware that reads configuration from database
 * and applies limits based on user subscription and module usage
 */
const dynamicRateLimit = (moduleId, moduleName) => {
  return async (req, res, next) => {
    try {
      // Skip if user is not authenticated
      if (!req.user) {
        return next();
      }

      // Get rate limit configuration
      const config = await RateLimitConfig.getDefault();
      
      // Skip if rate limiting is disabled globally
      if (!config.isEnabled) {
        return next();
      }

      // Check if this module is restricted
      if (!config.isModuleRestricted(moduleId)) {
        return next();
      }

      // Check maintenance mode
      if (config.overrideSettings.maintenanceMode.isEnabled) {
        return res.status(503).json({
          success: false,
          message: config.overrideSettings.maintenanceMode.message,
          error: 'SERVICE_MAINTENANCE',
          retryAfter: 3600 // 1 hour
        });
      }

      const userId = req.user._id;
      const userInfo = {
        username: req.user.username || req.user.email,
        email: req.user.email,
        subscriptionType: req.user.subscriptionType || 'free'
      };

      // Get effective daily limit for this user
      const effectiveDailyLimit = config.getEffectiveDailyLimit(req.user);
      
      // Handle unlimited users (exempted)
      if (effectiveDailyLimit === Infinity) {
        return next();
      }

      // Get or create daily usage record
      const dailyUsage = await DailyUsageLimit.getOrCreateDaily(
        userId, 
        userInfo, 
        effectiveDailyLimit
      );

      // Check if user is blocked
      if (dailyUsage.isBlocked) {
        return res.status(429).json({
          success: false,
          message: `Tài khoản của bạn đã bị tạm khóa: ${dailyUsage.blockReason}`,
          error: 'ACCOUNT_BLOCKED',
          usage: {
            current: dailyUsage.totalUsage,
            limit: dailyUsage.dailyLimit,
            remaining: 0,
            percentage: 100
          },
          blockInfo: {
            blockedAt: dailyUsage.blockedAt,
            reason: dailyUsage.blockReason
          }
        });
      }

      const moduleWeight = config.getModuleWeight(moduleId);
      
      // Check if user would exceed limit with this request
      const projectedUsage = dailyUsage.totalUsage + moduleWeight;
      const hasExceededLimit = projectedUsage > effectiveDailyLimit;

      // Handle burst mode if enabled and user has exceeded normal limit
      let canUseBurst = false;
      if (hasExceededLimit && config.burstSettings.isEnabled) {
        canUseBurst = dailyUsage.canUseBurst(
          config.burstSettings.burstLimit,
          config.burstSettings.burstWindowMinutes
        );
        
        if (canUseBurst) {
          // Allow burst usage
          dailyUsage.burstUsage.currentBurst += moduleWeight;
          dailyUsage.burstUsage.lastBurstUsed = new Date();
          
          // Set cooldown if burst limit reached
          if (dailyUsage.burstUsage.currentBurst >= config.burstSettings.burstLimit) {
            const cooldownEnd = new Date();
            cooldownEnd.setMinutes(cooldownEnd.getMinutes() + config.burstSettings.cooldownMinutes);
            dailyUsage.burstUsage.cooldownUntil = cooldownEnd;
          }
        }
      }

      // Block request if limit exceeded and no burst available
      if (hasExceededLimit && !canUseBurst) {
        return res.status(429).json({
          success: false,
          message: `Bạn đã vượt quá giới hạn ${effectiveDailyLimit} requests/ngày cho các module chính. Vui lòng thử lại vào ngày mai hoặc nâng cấp gói.`,
          error: 'DAILY_LIMIT_EXCEEDED',
          usage: {
            current: dailyUsage.totalUsage,
            limit: dailyUsage.dailyLimit,
            remaining: Math.max(0, dailyUsage.dailyLimit - dailyUsage.totalUsage),
            percentage: dailyUsage.getUsagePercentage()
          },
          module: {
            id: moduleId,
            name: moduleName,
            weight: moduleWeight
          },
          suggestions: [
            'Thử lại vào ngày mai khi quota được reset',
            'Nâng cấp gói subscription để tăng giới hạn hàng ngày',
            'Sử dụng các module khác không bị giới hạn'
          ],
          resetTime: config.resetTime,
          timezone: config.timezone
        });
      }

      // Check and issue warnings if needed
      const currentPercentage = Math.round((projectedUsage / effectiveDailyLimit) * 100);
      for (const warning of config.warningThresholds) {
        if (warning.isActive && currentPercentage >= warning.percentage) {
          const warningAdded = dailyUsage.addWarning(warning.percentage, warning.message);
          if (warningAdded) {
            // Add warning to response headers for frontend to display
            res.set('X-Usage-Warning', warning.message);
            res.set('X-Usage-Percentage', currentPercentage.toString());
          }
        }
      }

      // Record the usage
      const requestMetadata = {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        requestId: req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      dailyUsage.addUsage(moduleId, moduleName, moduleWeight, requestMetadata);
      await dailyUsage.save();

      // Add usage info to response headers for frontend
      res.set('X-Daily-Usage-Current', dailyUsage.totalUsage.toString());
      res.set('X-Daily-Usage-Limit', dailyUsage.dailyLimit.toString());
      res.set('X-Daily-Usage-Remaining', dailyUsage.getRemainingQuota().toString());
      res.set('X-Daily-Usage-Percentage', dailyUsage.getUsagePercentage().toString());

      // Add usage info to request object for downstream middleware
      req.usageInfo = {
        current: dailyUsage.totalUsage,
        limit: dailyUsage.dailyLimit,
        remaining: dailyUsage.getRemainingQuota(),
        percentage: dailyUsage.getUsagePercentage(),
        module: {
          id: moduleId,
          name: moduleName,
          weight: moduleWeight
        }
      };

      next();
    } catch (error) {
      console.error('Dynamic rate limit middleware error:', error);
      
      // In case of error, allow request but log the error
      // This prevents the entire system from breaking if rate limiting fails
      next();
    }
  };
};

/**
 * Middleware factory to create rate limiters for specific modules
 */
const createModuleRateLimit = (moduleId, moduleName) => {
  return dynamicRateLimit(moduleId, moduleName);
};

/**
 * Get current usage status for a user
 */
const getUserUsageStatus = async (userId) => {
  try {
    const config = await RateLimitConfig.getDefault();
    const today = new Date().toISOString().split('T')[0];
    
    const dailyUsage = await DailyUsageLimit.findOne({ userId, date: today });
    
    if (!dailyUsage) {
      return {
        current: 0,
        limit: config.dailyLimit,
        remaining: config.dailyLimit,
        percentage: 0,
        isBlocked: false,
        moduleUsage: []
      };
    }

    return {
      current: dailyUsage.totalUsage,
      limit: dailyUsage.dailyLimit,
      remaining: dailyUsage.getRemainingQuota(),
      percentage: dailyUsage.getUsagePercentage(),
      isBlocked: dailyUsage.isBlocked,
      blockReason: dailyUsage.blockReason,
      moduleUsage: dailyUsage.moduleUsage,
      warningsIssued: dailyUsage.warningsIssued,
      lastActivity: dailyUsage.lastActivity
    };
  } catch (error) {
    console.error('Error getting user usage status:', error);
    return null;
  }
};

/**
 * Reset daily usage for all users (typically run at midnight)
 */
const resetDailyUsage = async () => {
  try {
    const config = await RateLimitConfig.getDefault();
    const retentionDays = config.monitoringSettings.retentionDays;
    
    // Clean up old records
    const cleanupResult = await DailyUsageLimit.cleanupOldRecords(retentionDays);
    console.log(`Cleaned up ${cleanupResult.deletedCount} old usage records`);
    
    return { success: true, cleanedRecords: cleanupResult.deletedCount };
  } catch (error) {
    console.error('Error resetting daily usage:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check for potential account sharing based on usage patterns
 */
const detectPotentialSharing = async (days = 7) => {
  try {
    const heavyUsers = await DailyUsageLimit.getHeavyUsers(days, 0.85);
    return heavyUsers;
  } catch (error) {
    console.error('Error detecting potential sharing:', error);
    return [];
  }
};

module.exports = {
  dynamicRateLimit,
  createModuleRateLimit,
  getUserUsageStatus,
  resetDailyUsage,
  detectPotentialSharing
};