const UserSession = require('../models/UserSession');
const User = require('../models/User');

/**
 * Universal Activity Tracking Middleware
 * Automatically updates UserSession.lastActivity for ALL authenticated API calls
 */
const updateUserActivity = async (req, res, next) => {
  // Only track if user is authenticated
  if (!req.user || !req.user.id) {
    return next();
  }

  try {
    const userId = req.user.id;
    const now = new Date();
    
    // Get user info for session creation if needed
    const user = await User.findById(userId).select('username');
    
    if (!user) {
      console.warn(`⚠️ User ${userId} not found for activity tracking`);
      return next();
    }

    // Find existing active session or create new one
    let session = await UserSession.findOne({
      userId: userId,
      isActive: true
    });

    if (session) {
      // Update existing session
      session.lastActivity = now;
      await session.save();
      console.log(`✅ Activity updated for ${user.username}`);
    } else {
      // Create new session if none exists
      session = new UserSession({
        userId: userId,
        username: user.username,
        sessionToken: req.headers['x-auth-token'] || req.headers.authorization || 'auto-session',
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.get('User-Agent') || '',
        isActive: true,
        loginAt: now,
        lastActivity: now
      });
      
      await session.save();
      console.log(`🆕 New session created for ${user.username}`);
    }

    // Optional: Add session info to request for other middlewares
    req.userSession = session;

  } catch (error) {
    console.error('❌ Error in activity tracking middleware:', error);
    // Don't fail the request if activity tracking fails
  }

  next();
};

/**
 * Mark user as offline when they logout
 */
const markUserOffline = async (userId) => {
  try {
    await UserSession.updateMany(
      { userId: userId, isActive: true },
      { 
        isActive: false,
        logoutAt: new Date(),
        logoutReason: 'USER_LOGOUT'
      }
    );
    console.log(`🔴 User ${userId} marked offline`);
  } catch (error) {
    console.error('❌ Error marking user offline:', error);
  }
};

/**
 * Clean up old inactive sessions (older than 24 hours)
 */
const cleanupOldSessions = async () => {
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await UserSession.deleteMany({
      lastActivity: { $lt: yesterday },
      isActive: false
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old sessions`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up sessions:', error);
  }
};

module.exports = {
  updateUserActivity,
  markUserOffline,
  cleanupOldSessions
};