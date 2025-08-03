const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { 
  antiSharingMiddleware, 
  validateAntiSharing, 
  checkAccountBlock 
} = require('../middleware/antiSharing');
const { 
  checkConcurrentSession, 
  validateActiveSession,
  sessionHeartbeat,
  forceLogoutAllSessions,
  getActiveSessionInfo 
} = require('../middleware/singleSession');

// Handle preflight OPTIONS requests
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-auth-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// @route   GET api/auth/me
// @desc    Get user data
// @access  Private
router.get('/me', checkAccountBlock, auth, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
});

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', antiSharingMiddleware, async (req, res) => {
  const { username, email, password } = req.body;

  try {
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ msg: 'User with this email or username already exists' });
    }

    user = new User({
      username,
      email,
      password,
    });

    await user.save();

    // Run anti-sharing validation for new user
    if (req.antiSharingData) {
      const antiSharingResult = await validateAntiSharing(user.id, req.antiSharingData);
      
      if (!antiSharingResult.allowed) {
        return res.status(403).json({
          success: false,
          blocked: true,
          reason: antiSharingResult.reason,
          blockInfo: antiSharingResult.blockInfo,
          message: 'Account registration blocked due to suspicious activity detection.'
        });
      }
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
      async (err, token) => {
        if (err) throw err;
        
        // Create UserSession for online tracking
        try {
          const sessionToken = req.antiSharingData?.sessionToken || token;
          
          // Create new session for new user
          const sessionData = {
            userId: user._id,
            username: user.username,
            sessionToken: sessionToken,
            ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || '',
            isActive: true,
            loginAt: new Date(),
            lastActivity: new Date()
          };
          
          // Only add deviceFingerprintId if it exists
          if (req.antiSharingData?.deviceFingerprintId) {
            sessionData.deviceFingerprintId = req.antiSharingData.deviceFingerprintId;
          }
          
          const newSession = new UserSession(sessionData);
          
          await newSession.save();
          console.log(`✅ UserSession created for new user ${user.username}`);
          
        } catch (sessionErr) {
          console.error('❌ Error creating UserSession for new user:', sessionErr);
          // Don't fail registration if session creation fails
        }
        
        res.json({ 
          token,
          sessionToken: req.antiSharingData?.sessionToken
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', checkConcurrentSession, antiSharingMiddleware, async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Run anti-sharing validation after successful authentication
    if (req.antiSharingData) {
      const antiSharingResult = await validateAntiSharing(user.id, req.antiSharingData);
      
      if (!antiSharingResult.allowed) {
        return res.status(403).json({
          success: false,
          blocked: true,
          reason: antiSharingResult.reason,
          blockInfo: antiSharingResult.blockInfo,
          sharingScore: antiSharingResult.sharingScore,
          message: 'Login blocked due to account sharing detection. Please contact support if you believe this is an error.'
        });
      }
    }

    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
      async (err, token) => {
        if (err) throw err;
        
        // Create UserSession for online tracking
        try {
          const sessionToken = req.antiSharingData?.sessionToken || token;
          
          // Force logout previous sessions (single session enforcement)
          await UserSession.updateMany(
            { userId: user._id, isActive: true },
            { 
              isActive: false, 
              logoutAt: new Date(),
              logoutReason: 'FORCE_LOGOUT'
            }
          );
          
          // Create new session
          const sessionData = {
            userId: user._id,
            username: user.username,
            sessionToken: sessionToken,
            ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || '',
            isActive: true,
            loginAt: new Date(),
            lastActivity: new Date()
          };
          
          // Only add deviceFingerprintId if it exists
          if (req.antiSharingData?.deviceFingerprintId) {
            sessionData.deviceFingerprintId = req.antiSharingData.deviceFingerprintId;
          }
          
          const newSession = new UserSession(sessionData);
          
          await newSession.save();
          console.log(`✅ UserSession created for user ${user.username}`);
          
        } catch (sessionErr) {
          console.error('❌ Error creating UserSession:', sessionErr);
          // Don't fail login if session creation fails
        }
        
        res.json({ 
          token,
          sessionToken: req.antiSharingData?.sessionToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            subscriptionType: user.subscriptionType
          },
          singleSession: true, // Indicate single session mode
          message: 'Đăng nhập thành công! Nếu bạn đăng nhập ở thiết bị khác, phiên này sẽ bị ngắt.'
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/auth/heartbeat
// @desc    Keep session alive with heartbeat
router.post('/heartbeat', sessionHeartbeat);

// @route   GET /api/auth/session-status
// @desc    Check current session status
router.get('/session-status', async (req, res) => {
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

    const UserSession = require('../models/UserSession');
    const session = await UserSession.findOne({
      sessionToken,
      isActive: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'SESSION_NOT_FOUND',
        status: 'expired',
        message: 'Session không tồn tại hoặc đã hết hạn'
      });
    }

    // Check for newer sessions (concurrent login)
    const newerSessions = await UserSession.find({
      userId: session.userId,
      isActive: true,
      loginAt: { $gt: session.loginAt }
    });

    if (newerSessions.length > 0) {
      return res.json({
        success: false,
        error: 'SESSION_TERMINATED',
        status: 'terminated',
        message: 'Tài khoản đã được đăng nhập từ thiết bị khác',
        terminatedByNewLogin: true
      });
    }

    // Check session timeout
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    
    if (now - lastActivity > SESSION_TIMEOUT) {
      return res.json({
        success: false,
        error: 'SESSION_EXPIRED',
        status: 'expired',
        message: 'Phiên đăng nhập đã hết hạn do không hoạt động'
      });
    }

    res.json({
      success: true,
      status: 'active',
      sessionInfo: {
        loginAt: session.loginAt,
        lastActivity: session.lastActivity,
        totalApiCalls: session.activityMetrics.totalApiCalls,
        ipAddress: session.ipAddress
      },
      message: 'Session đang hoạt động bình thường'
    });
  } catch (error) {
    console.error('❌ Session status check error:', error);
    res.status(500).json({
      success: false,
      error: 'SESSION_STATUS_ERROR',
      message: 'Lỗi kiểm tra trạng thái session'
    });
  }
});

// @route   POST /api/auth/force-logout
// @desc    Force logout all sessions for current user
router.post('/force-logout', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const loggedOutSessions = await forceLogoutAllSessions(userId, 'USER_REQUESTED');
    
    res.json({
      success: true,
      message: `Đã ngắt kết nối ${loggedOutSessions} phiên đăng nhập`,
      loggedOutSessions
    });
  } catch (error) {
    console.error('❌ Force logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi ngắt kết nối phiên đăng nhập'
    });
  }
});

// @route   GET /api/auth/active-session
// @desc    Get active session info for current user
router.get('/active-session', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionInfo = await getActiveSessionInfo(userId);
    
    if (!sessionInfo) {
      return res.json({
        success: true,
        hasActiveSession: false,
        message: 'Không có phiên đăng nhập nào đang hoạt động'
      });
    }

    res.json({
      success: true,
      hasActiveSession: true,
      sessionInfo,
      message: 'Thông tin phiên đăng nhập hiện tại'
    });
  } catch (error) {
    console.error('❌ Get active session error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin phiên đăng nhập'
    });
  }
});

module.exports = router; 