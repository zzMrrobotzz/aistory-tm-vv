const cron = require('node-cron');
const DailyUsageLimit = require('../models/DailyUsageLimit');
const RateLimitConfig = require('../models/RateLimitConfig');

/**
 * Daily Reset Service - Handles automatic reset of daily usage limits
 * Uses Vietnam timezone (Asia/Ho_Chi_Minh) for accurate reset timing
 */
class DailyResetService {
  constructor() {
    this.isRunning = false;
    this.lastResetDate = null;
  }

  /**
   * Get current Vietnam date in YYYY-MM-DD format
   */
  getVietnamDate() {
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    return vietnamTime.toISOString().split('T')[0];
  }

  /**
   * Get current Vietnam time in HH:mm format  
   */
  getVietnamTime() {
    const now = new Date();
    const vietnamTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    return vietnamTime.toTimeString().slice(0, 5); // HH:mm format
  }

  /**
   * Manual reset function - can be called by admin or cron
   */
  async performDailyReset(force = false) {
    try {
      const currentDate = this.getVietnamDate();
      const currentTime = this.getVietnamTime();
      
      console.log(`[Daily Reset] Starting reset check at ${currentTime} Vietnam time (${currentDate})`);
      
      // Prevent multiple resets on same day unless forced
      if (!force && this.lastResetDate === currentDate) {
        console.log(`[Daily Reset] Already reset today (${currentDate}), skipping...`);
        return { success: true, message: 'Already reset today', skipped: true };
      }

      // Get configuration for retention settings
      const config = await RateLimitConfig.getDefault();
      const retentionDays = config.monitoringSettings.retentionDays || 30;
      
      // 1. Clean up old DailyUsageLimit records
      console.log(`[Daily Reset] Cleaning up records older than ${retentionDays} days...`);
      const cleanupResult = await DailyUsageLimit.cleanupOldRecords(retentionDays);
      console.log(`[Daily Reset] Cleaned up ${cleanupResult.deletedCount} old usage records`);

      // 2. Clean up old RequestTracking records (removed - no longer needed)
      console.log(`[Daily Reset] Skipping old tracking cleanup - using simplified system`);

      // 3. Reset any leftover usage for today (in case of timezone issues)
      const todayResetCount = await DailyUsageLimit.updateMany(
        { date: currentDate },
        { 
          $set: { 
            totalUsage: 0,
            'burstUsage.currentBurst': 0,
            'burstUsage.cooldownUntil': null,
            lastActivity: new Date()
          },
          $unset: {
            'burstUsage.burstStartTime': 1,
            'burstUsage.lastBurstUsed': 1
          },
          $pull: {
            requestHistory: { $exists: true }
          }
        }
      );
      console.log(`[Daily Reset] Reset ${todayResetCount.modifiedCount} today's usage records`);

      // 4. Reset RequestTracking for today (removed - using simplified system)
      console.log(`[Daily Reset] Skipping tracking reset - using simplified system`);

      // Update last reset date
      this.lastResetDate = currentDate;
      
      const result = {
        success: true,
        resetDate: currentDate,
        resetTime: currentTime,
        timezone: 'Asia/Ho_Chi_Minh',
        statistics: {
          oldRecordsCleanedUp: cleanupResult.deletedCount,
          oldTrackingCleaned: 0, // Removed - using simplified system
          todayUsageReset: todayResetCount.modifiedCount,
          todayTrackingReset: 0 // Removed - using simplified system
        }
      };

      console.log(`[Daily Reset] Completed successfully:`, result);
      return result;

    } catch (error) {
      console.error('[Daily Reset] Error during reset:', error);
      return { 
        success: false, 
        error: error.message,
        resetDate: this.getVietnamDate(),
        resetTime: this.getVietnamTime()
      };
    }
  }

  /**
   * Start the daily reset cron job
   * Runs at midnight Vietnam time (Asia/Ho_Chi_Minh)
   */
  startCronJob() {
    if (this.isRunning) {
      console.log('[Daily Reset] Cron job already running');
      return;
    }

    // Run at midnight Vietnam time every day
    // Using cron timezone option for accurate timing
    this.cronJob = cron.schedule('0 0 * * *', async () => {
      console.log('[Daily Reset] Cron job triggered at midnight Vietnam time');
      await this.performDailyReset();
    }, {
      scheduled: false,
      timezone: 'Asia/Ho_Chi_Minh'
    });

    // Start the cron job
    this.cronJob.start();
    this.isRunning = true;
    
    console.log('[Daily Reset] Cron job started - will reset daily at 00:00 Vietnam time');
    
    // Also run a reset on startup to clean up any issues
    setTimeout(async () => {
      console.log('[Daily Reset] Running startup cleanup...');
      await this.performDailyReset();
    }, 5000); // Wait 5 seconds after startup
  }

  /**
   * Stop the cron job
   */
  stopCronJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob.destroy();
      this.isRunning = false;
      console.log('[Daily Reset] Cron job stopped');
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastResetDate: this.lastResetDate,
      currentVietnamDate: this.getVietnamDate(),
      currentVietnamTime: this.getVietnamTime(),
      timezone: 'Asia/Ho_Chi_Minh'
    };
  }

  /**
   * Check if today's usage needs reset (for troubleshooting)
   */
  async checkTodayUsage() {
    try {
      const today = this.getVietnamDate();
      
      // Count today's usage records
      const usageCount = await DailyUsageLimit.countDocuments({ date: today });
      const trackingCount = await RequestTracking.countDocuments({ date: today });
      
      // Get sample of today's records
      const sampleUsage = await DailyUsageLimit.find({ date: today })
        .select('userId totalUsage dailyLimit lastActivity')
        .limit(5);
        
      const sampleTracking = await RequestTracking.find({ date: today })
        .select('userId requestCount dailyLimit lastRequestAt')
        .limit(5);

      return {
        date: today,
        vietnamTime: this.getVietnamTime(),
        counts: {
          usageRecords: usageCount,
          trackingRecords: trackingCount
        },
        samples: {
          usage: sampleUsage,
          tracking: sampleTracking
        }
      };
    } catch (error) {
      console.error('[Daily Reset] Error checking today usage:', error);
      return { error: error.message };
    }
  }
}

// Create singleton instance
const dailyResetService = new DailyResetService();

module.exports = dailyResetService;