const antiSharingService = require('../services/antiSharingService');
const jwt = require('jsonwebtoken');

/**
 * Anti-sharing middleware for login/register routes
 * Validates device fingerprint and session data
 */
const antiSharingMiddleware = async (req, res, next) => {
  try {
    // Extract device fingerprint and session data from request
    const {
      fingerprint,
      deviceInfo,
      sessionToken
    } = req.body;

    // Get IP address from request
    const ipAddress = req.ip || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     'unknown';

    const userAgent = req.headers['user-agent'] || '';

    // Skip anti-sharing check if no fingerprint provided (backward compatibility)
    if (!fingerprint) {
      console.log('⚠️ No device fingerprint provided, skipping anti-sharing check');
      return next();
    }

    // For login route, we need to get userId after password verification
    // So we'll store the session data in req for later use
    req.antiSharingData = {
      fingerprint,
      deviceInfo,
      ipAddress,
      userAgent,
      sessionToken: sessionToken || `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };

    next();
  } catch (error) {
    console.error('❌ Anti-sharing middleware error:', error);
    // Don't block the request on middleware errors
    next();
  }
};

/**
 * Anti-sharing validation after successful authentication
 * Call this after user is verified but before token is generated
 */
const validateAntiSharing = async (userId, sessionData) => {
  try {
    if (!sessionData) {
      console.log('⚠️ No anti-sharing data provided, skipping validation');
      return { allowed: true, fallback: true };
    }

    console.log(`🔍 Running anti-sharing validation for user: ${userId}`);
    
    const result = await antiSharingService.validateUserSession(userId, sessionData);
    
    if (result.allowed) {
      console.log(`✅ Anti-sharing check passed for user: ${userId} (score: ${result.sharingScore || 'N/A'})`);
    } else {
      console.log(`❌ Anti-sharing check failed for user: ${userId} - ${result.reason}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Anti-sharing validation error:', error);
    // Return allowed on error to prevent blocking legitimate users
    return { 
      allowed: true, 
      error: error.message, 
      fallback: true 
    };
  }
};

/**
 * Middleware to check if user is currently blocked
 */
const checkAccountBlock = async (req, res, next) => {
  try {
    // Extract user ID from token if present
    const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next(); // No token, proceed normally
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.user.id;

      // Check if user has active block
      const blockCheck = await antiSharingService.checkExistingBlock(userId);
      
      if (blockCheck) {
        const timeRemaining = blockCheck.getRemainingTime();
        const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
        
        return res.status(403).json({
          success: false,
          blocked: true,
          blockInfo: {
            reason: blockCheck.blockReason,
            blockedUntil: blockCheck.blockedUntil,
            hoursRemaining,
            sharingScore: blockCheck.sharingScore,
            appealInfo: blockCheck.appealInfo
          },
          message: `Account temporarily blocked due to ${blockCheck.blockReason.toLowerCase().replace(/_/g, ' ')}. Time remaining: ${hoursRemaining} hours.`
        });
      }

      req.userId = userId; // Store for other middleware
      next();
    } catch (jwtError) {
      // Invalid token, but don't block - let auth middleware handle it
      next();
    }
  } catch (error) {
    console.error('❌ Account block check error:', error);
    next(); // Don't block on errors
  }
};

/**
 * Express middleware to update session activity
 */
const updateSessionActivity = async (req, res, next) => {
  try {
    const userId = req.userId; // Set by checkAccountBlock or auth middleware
    const sessionToken = req.headers['x-session-token'] || req.headers['session-token'];
    
    if (userId && sessionToken) {
      // Update session activity asynchronously (don't wait)
      setImmediate(async () => {
        try {
          const UserSession = require('../models/UserSession');
          await UserSession.findOneAndUpdate(
            { userId, sessionToken, isActive: true },
            { 
              lastActivity: new Date(),
              $inc: { 'activityMetrics.totalApiCalls': 1 }
            }
          );
        } catch (updateError) {
          console.error('❌ Session activity update error:', updateError);
        }
      });
    }

    next();
  } catch (error) {
    console.error('❌ Session update middleware error:', error);
    next();
  }
};

module.exports = {
  antiSharingMiddleware,
  validateAntiSharing,
  checkAccountBlock,
  updateSessionActivity
};