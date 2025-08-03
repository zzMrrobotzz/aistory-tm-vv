const UserSession = require('../models/UserSession');

/**
 * Middleware to automatically update session activity for authenticated users
 * This should be used after auth middleware to track user activity
 */
const autoUpdateSessionActivity = async (req, res, next) => {
  // Only proceed if user is authenticated
  if (!req.user || !req.user.id) {
    return next();
  }

  try {
    // Get session token from various headers
    const sessionToken = req.headers['x-session-token'] || 
                        req.headers['session-token'] ||
                        req.headers['authorization']?.replace('Bearer ', '');

    if (sessionToken) {
      // Update session activity asynchronously (don't wait)
      setImmediate(async () => {
        try {
          const result = await UserSession.findOneAndUpdate(
            { 
              userId: req.user.id, 
              sessionToken: sessionToken, 
              isActive: true 
            },
            { 
              lastActivity: new Date(),
              $inc: { 'activityMetrics.totalApiCalls': 1 }
            },
            { new: true }
          );

          if (result) {
            console.log(`🔄 Updated session activity for user ${req.user.id}`);
          } else {
            console.log(`⚠️ No active session found for user ${req.user.id} with token ${sessionToken.substring(0, 10)}...`);
          }
        } catch (updateError) {
          console.error('❌ Auto session activity update error:', updateError);
        }
      });
    }
  } catch (error) {
    console.error('❌ Auto session middleware error:', error);
    // Don't fail the request if session update fails
  }

  next();
};

module.exports = {
  autoUpdateSessionActivity
};