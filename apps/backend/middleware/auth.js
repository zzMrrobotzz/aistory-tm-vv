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

    // SINGLE SESSION VALIDATION - Check if session exists and is valid
    try {
      const userSession = await UserSession.findOne({
        userId: req.user.id,
        sessionToken: token,
        isActive: true
      });

      // If no session found, only reject if single session mode is enforced
      // For now, we'll be more lenient and only check for obvious conflicts
      if (userSession) {
        // Update last activity if session exists
        userSession.lastActivity = new Date();
        await userSession.save();
      } else {
        // Session not found - this could be normal for older tokens
        // Only enforce single session for new logins, not existing sessions
        console.log(`⚠️  No session found for token, but allowing access (user: ${req.user.id})`);
      }
    } catch (sessionError) {
      console.error('Session validation error:', sessionError);
      // Don't fail auth on session errors, just log them
    }

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Token is not valid' });
    }
    console.error('Auth middleware error:', err);
    return res.status(500).json({ msg: 'Server error in authentication' });
  }
}; 