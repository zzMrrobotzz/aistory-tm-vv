const UserSession = require('../models/UserSession');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

/**
 * Single Session Management Middleware
 * Ensures only one active session per user at a time
 */

/**
 * Check if user has active session and handle concurrent login
 */
const checkConcurrentSession = async (req, res, next) => {
  try {
    const { email, username } = req.body;
    const userIdentifier = email || username;
    
    if (!userIdentifier) {
      return next();
    }

    // Find user
    const user = await User.findOne({ 
      $or: [{ email: userIdentifier }, { username: userIdentifier }] 
    });
    
    if (!user) {
      return next(); // User doesn't exist, let normal auth flow handle it
    }

    // Check for active sessions
    const activeSessions = await UserSession.find({
      userId: user._id,
      isActive: true
    }).sort({ lastActivity: -1 });

    if (activeSessions.length > 0) {
      const activeSession = activeSessions[0];
      const lastActivityTime = new Date(activeSession.lastActivity);
      const now = new Date();
      const timeDifference = now - lastActivityTime;
      
      // If last activity was within 5 minutes, consider session still active
      const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
      
      if (timeDifference < SESSION_TIMEOUT) {
        // Session is still active, check subscription type for session limits
        const subscriptionType = user.subscriptionType || 'free';
        
        // For single session enforcement, we'll force logout previous session
        console.log(`🔒 User ${user.username} attempting concurrent login - forcing logout of previous session`);
        
        // Force logout all active sessions
        await UserSession.updateMany(
          { userId: user._id, isActive: true },
          {
            isActive: false,
            logoutAt: new Date(),
            logoutReason: 'CONCURRENT_LOGIN_DETECTED'
          }
        );

        // Log the concurrent login attempt
        await createAuditLog('CONCURRENT_LOGIN', 
          `User ${user.username} logged in from new location, previous session terminated`
        );

        // Store user info for the new session
        req.userId = user._id;
        req.userInfo = user;
      }
    }

    next();
  } catch (error) {
    console.error('❌ Concurrent session check error:', error);
    next(); // Don't block login on error
  }
};

/**
 * Validate active session before API calls
 */
const validateActiveSession = async (req, res, next) => {
  try {
    // Get session token from headers
    const sessionToken = req.headers['x-session-token'] || 
                        req.headers['session-token'] ||
                        req.body.sessionToken;
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        error: 'SESSION_REQUIRED',
        message: 'Session token is required'
      });
    }

    // Find active session
    const session = await UserSession.findOne({
      sessionToken,
      isActive: true
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'SESSION_INVALID',
        message: 'Session không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'
      });
    }

    // Check session timeout (30 minutes of inactivity)
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    
    if (now - lastActivity > SESSION_TIMEOUT) {
      // Session expired due to inactivity
      session.isActive = false;
      session.logoutAt = new Date();
      session.logoutReason = 'SESSION_TIMEOUT';
      await session.save();
      
      return res.status(401).json({
        success: false,
        error: 'SESSION_EXPIRED',
        message: 'Phiên đăng nhập đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.'
      });
    }

    // Check if there's a newer session for this user (concurrent login detection)
    const newerSessions = await UserSession.find({
      userId: session.userId,
      isActive: true,
      loginAt: { $gt: session.loginAt }
    });

    if (newerSessions.length > 0) {
      // User logged in from another location, terminate this session
      session.isActive = false;
      session.logoutAt = new Date();
      session.logoutReason = 'CONCURRENT_LOGIN_DETECTED';
      await session.save();
      
      return res.status(403).json({
        success: false,
        error: 'SESSION_TERMINATED',
        message: 'Tài khoản đã được đăng nhập từ thiết bị khác. Phiên làm việc hiện tại đã bị ngắt kết nối.',
        terminatedByNewLogin: true
      });
    }

    // Update last activity
    session.lastActivity = new Date();
    session.activityMetrics.totalApiCalls += 1;
    await session.save();

    // Store session info in request
    req.sessionInfo = session;
    req.userId = session.userId;
    
    next();
  } catch (error) {
    console.error('❌ Session validation error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_VALIDATION_ERROR',
      message: 'Lỗi kiểm tra phiên đăng nhập'
    });
  }
};

/**
 * Heartbeat endpoint to keep session alive
 */
const sessionHeartbeat = async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || 
                        req.headers['session-token'];
    
    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        error: 'SESSION_TOKEN_REQUIRED',
        message: 'Session token is required'
      });
    }

    const session = await UserSession.findOne({
      sessionToken,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or expired'
      });
    }

    // Check for concurrent sessions
    const newerSessions = await UserSession.find({
      userId: session.userId,
      isActive: true,
      loginAt: { $gt: session.loginAt }
    });

    if (newerSessions.length > 0) {
      // Session was terminated by newer login
      session.isActive = false;
      session.logoutAt = new Date();
      session.logoutReason = 'CONCURRENT_LOGIN_DETECTED';
      await session.save();
      
      return res.status(403).json({
        success: false,
        error: 'SESSION_TERMINATED',
        message: 'Session terminated by concurrent login',
        terminatedByNewLogin: true
      });
    }

    // Update heartbeat timestamp
    session.lastActivity = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Session heartbeat updated',
      lastActivity: session.lastActivity
    });
  } catch (error) {
    console.error('❌ Session heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: 'HEARTBEAT_ERROR',
      message: 'Failed to update session heartbeat'
    });
  }
};

/**
 * Force logout user from all sessions
 */
const forceLogoutAllSessions = async (userId, reason = 'ADMIN_FORCE_LOGOUT') => {
  try {
    const result = await UserSession.updateMany(
      { userId, isActive: true },
      {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: reason
      }
    );

    console.log(`🚪 Force logged out ${result.modifiedCount} sessions for user: ${userId}`);
    
    await createAuditLog('FORCE_LOGOUT_ALL', 
      `All active sessions terminated for user ${userId}. Reason: ${reason}`
    );

    return result.modifiedCount;
  } catch (error) {
    console.error('❌ Force logout error:', error);
    throw error;
  }
};

/**
 * Get active session info for user
 */
const getActiveSessionInfo = async (userId) => {
  try {
    const activeSession = await UserSession.findOne({
      userId,
      isActive: true
    }).sort({ lastActivity: -1 });

    if (!activeSession) {
      return null;
    }

    const now = new Date();
    const lastActivity = new Date(activeSession.lastActivity);
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    
    // Check if session is actually still active
    if (now - lastActivity > SESSION_TIMEOUT) {
      // Mark as expired
      activeSession.isActive = false;
      activeSession.logoutAt = new Date();
      activeSession.logoutReason = 'SESSION_TIMEOUT';
      await activeSession.save();
      return null;
    }

    return {
      sessionId: activeSession._id,
      sessionToken: activeSession.sessionToken,
      loginAt: activeSession.loginAt,
      lastActivity: activeSession.lastActivity,
      ipAddress: activeSession.ipAddress,
      userAgent: activeSession.userAgent,
      totalApiCalls: activeSession.activityMetrics.totalApiCalls
    };
  } catch (error) {
    console.error('❌ Get active session error:', error);
    return null;
  }
};

module.exports = {
  checkConcurrentSession,
  validateActiveSession,
  sessionHeartbeat,
  forceLogoutAllSessions,
  getActiveSessionInfo
};