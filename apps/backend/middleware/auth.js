const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserSession = require('../models/UserSession');

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;

    // SINGLE SESSION VALIDATION - Check if session is still active
    const userSession = await UserSession.findOne({
      userId: req.user.id,
      sessionToken: token,
      isActive: true
    });

    if (!userSession) {
      // Session has been terminated (concurrent login detected)
      return res.status(401).json({ 
        msg: 'Session terminated', 
        sessionTerminated: true,
        reason: 'Your session has been terminated due to login from another device/browser'
      });
    }

    // Update last activity
    userSession.lastActivity = new Date();
    await userSession.save();

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Token is not valid' });
    }
    console.error('Auth middleware error:', err);
    return res.status(500).json({ msg: 'Server error in authentication' });
  }
}; 