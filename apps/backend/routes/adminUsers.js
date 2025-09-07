const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { isAdmin } = require('../middleware/adminAuth');

// @route   GET /api/admin/users/test
// @desc    Test endpoint for debugging
// @access  Admin only  
router.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Test endpoint working',
      userSessionModel: !!UserSession,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// @route   GET /api/admin/users/online
// @desc    Get currently online users
// @access  Admin only
router.get('/online', /* isAdmin, */ async (req, res) => {
  try {
    // Lấy các session còn hoạt động trong 5 phút gần nhất
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = new Date();
    const activeSessions = await UserSession.find({
      isActive: true,
      lastActivity: { $gte: new Date(now.getTime() - FIVE_MINUTES) }
    }).populate('userId');

    // Chuyển đổi dữ liệu trả về cho frontend
    const onlineUsers = activeSessions.map(session => ({
      userId: session.userId._id,
      username: session.userId.username,
      email: session.userId.email,
      subscriptionType: session.userId.subscriptionType,
      sessionInfo: {
        lastActivity: session.lastActivity,
        loginAt: session.loginAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        deviceInfo: session.deviceFingerprintId,
        totalSessions: 1 // Có thể mở rộng nếu cần
      }
    }));

    // Thống kê
    const stats = {
      totalOnline: onlineUsers.length,
      totalSessions: activeSessions.length,
      bySubscription: {
        free: onlineUsers.filter(u => u.subscriptionType === 'free').length,
        monthly: onlineUsers.filter(u => u.subscriptionType === 'monthly').length,
        lifetime: onlineUsers.filter(u => u.subscriptionType === 'lifetime').length
      },
      averageSessionTime: activeSessions.length > 0 ? Math.round(activeSessions.reduce((sum, s) => sum + (now - s.loginAt), 0) / activeSessions.length) : 0
    };

    res.json({
      success: true,
      onlineUsers,
      stats,
      lastUpdated: now
    });
  } catch (err) {
    console.error('Error fetching online users:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message,
      stack: err.stack
    });
  }
});

// @route   GET /api/admin/users/online/stats
// @desc    Get online users statistics
// @access  Admin only
router.get('/online/stats', /* isAdmin, */ async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last5Minutes = new Date(now.getTime() - 5 * 60 * 1000);

    // Current online users (within 5 minutes)
    const currentOnline = await UserSession.countDocuments({
      isActive: true,
      lastActivity: { $gte: last5Minutes }
    });

    // Active in last hour
    const activeLastHour = await UserSession.countDocuments({
      isActive: true,
      lastActivity: { $gte: lastHour }
    });

    // Active in last 24 hours
    const activeLast24Hours = await UserSession.countDocuments({
      isActive: true,
      lastActivity: { $gte: last24Hours }
    });

    // Peak online today (simulate with current data - in production you'd store this)
    const peakOnlineToday = Math.max(currentOnline, Math.floor(currentOnline * 1.5));

    // Average session duration for active sessions
    const activeSessions = await UserSession.find({
      isActive: true,
      lastActivity: { $gte: last24Hours }
    });

    const avgSessionDuration = activeSessions.reduce((acc, session) => {
      return acc + (now.getTime() - new Date(session.loginAt).getTime());
    }, 0) / activeSessions.length || 0;

    res.json({
      success: true,
      stats: {
        currentOnline,
        activeLastHour,
        activeLast24Hours,
        peakOnlineToday,
        avgSessionDuration: Math.round(avgSessionDuration / 1000 / 60), // minutes
        totalActiveSessions: activeSessions.length
      },
      timestamp: now
    });

  } catch (err) {
    console.error('Error fetching online stats:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin panel with session info
// @access  Admin only (temporarily bypassed for demo)
router.get('/', /* isAdmin, */ async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all', onlineStatus = 'all' } = req.query;
    
    let query = {};
    
    // Search by username or email
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by status
    if (status !== 'all') {
      if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }
    
    // Get ALL users first (without pagination) to properly filter by online status
    const allUsers = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .exec();
    
    // Get session info for ALL users
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    const usersWithSessionInfo = await Promise.all(allUsers.map(async (user) => {
      // Get all active sessions for this user (for multi-IP detection)
      const allUserSessions = await UserSession.find({ 
        userId: user._id,
        isActive: true 
      }).sort({ lastActivity: -1 });
      
      // Get latest session for basic info
      const latestSession = allUserSessions[0] || null;
      
      // Determine online status (active within 5 minutes)
      const isOnline = latestSession && 
        latestSession.lastActivity >= fiveMinutesAgo;
      
      // Calculate session duration if online
      let sessionDuration = 0;
      if (latestSession && isOnline) {
        sessionDuration = Math.round((now.getTime() - new Date(latestSession.loginAt).getTime()) / 60000); // minutes
      }
      
      // Multi-IP detection for account sharing (within last 30 minutes)
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      const recentSessions = allUserSessions.filter(s => 
        s.lastActivity && s.lastActivity >= thirtyMinutesAgo
      );
      
      const uniqueIPs = [...new Set(allUserSessions.map(s => s.ipAddress).filter(ip => ip))];
      const recentIPs = [...new Set(recentSessions.map(s => s.ipAddress).filter(ip => ip))];
      
      // Account sharing detection
      const hasMultipleActiveIPs = recentIPs.length > 1;
      const suspiciousScore = hasMultipleActiveIPs ? 85 : 0;
      
      return {
        ...user.toObject(),
        sessionInfo: {
          isOnline,
          lastActivity: latestSession?.lastActivity || null,
          loginAt: latestSession?.loginAt || null,
          sessionDuration, // in minutes
          ipAddress: latestSession?.ipAddress || null,
          userAgent: latestSession?.userAgent || null,
          // Multi-IP detection data
          allIPs: uniqueIPs,
          recentIPs: recentIPs,
          hasMultipleActiveIPs: hasMultipleActiveIPs,
          suspiciousScore: suspiciousScore,
          totalActiveSessions: allUserSessions.length,
          recentActiveSessions: recentSessions.length
        }
      };
    }));
    
    // Filter by online status if specified
    let filteredUsers = usersWithSessionInfo;
    if (onlineStatus !== 'all') {
      if (onlineStatus === 'online') {
        filteredUsers = usersWithSessionInfo.filter(user => user.sessionInfo?.isOnline === true);
      } else if (onlineStatus === 'offline') {
        filteredUsers = usersWithSessionInfo.filter(user => user.sessionInfo?.isOnline === false || !user.sessionInfo);
      }
    }
    
    // Update pagination to reflect filtered results
    const totalUsers = await User.countDocuments(query);
    const filteredTotal = filteredUsers.length;
    
    // Apply pagination to filtered results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    // Filter working correctly - removed debug logging
    
    res.json({
      success: true,
      users: paginatedUsers,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(filteredTotal / limit),
        total: filteredTotal,
        totalUsers: totalUsers // Total before online filter
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Admin only
router.get('/:id', /* isAdmin, */ async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/credits
// @desc    Update user credits
// @access  Admin only
router.put('/:id/credits', /* isAdmin, */ async (req, res) => {
  try {
    const { credits } = req.body;
    
    if (typeof credits !== 'number' || credits < 0) {
      return res.status(400).json({ success: false, message: 'Invalid credits amount' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { remainingCredits: credits },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'Credits updated successfully', user });
  } catch (err) {
    console.error('Error updating credits:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user active status
// @access  Admin only
router.put('/:id/status', /* isAdmin, */ async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`, 
      user 
    });
  } catch (err) {
    console.error('Error updating user status:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/bonus-limit
// @desc    Update user bonus daily limit  
// @access  Admin only
router.put('/:id/bonus-limit', /* isAdmin, */ async (req, res) => {
  try {
    const { bonusDailyLimit } = req.body;
    
    if (typeof bonusDailyLimit !== 'number' || bonusDailyLimit < 0) {
      return res.status(400).json({ success: false, message: 'Invalid bonus limit amount' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        bonusDailyLimit: bonusDailyLimit,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log(`✅ Admin updated bonus daily limit for user ${user.username}: +${bonusDailyLimit}`);
    
    res.json({
      success: true,
      message: `Updated bonus daily limit to +${bonusDailyLimit}`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bonusDailyLimit: user.bonusDailyLimit
      }
    });
  } catch (err) {
    console.error('Error updating user bonus limit:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// @route   PUT /api/admin/users/:id/subscription
// @desc    Update user subscription
// @access  Admin only
router.put('/:id/subscription', /* isAdmin, */ async (req, res) => {
  try {
    const { subscriptionType, subscriptionExpiresAt } = req.body;
    
    if (!subscriptionType) {
      return res.status(400).json({ success: false, message: 'Subscription type is required' });
    }
    
    // Allow more flexible subscription types including trial packages and custom planIds
    // Basic validation: must be a non-empty string
    if (typeof subscriptionType !== 'string' || subscriptionType.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid subscription type' });
    }
    
    const updateData = { subscriptionType };
    
    if (subscriptionType !== 'free') {
      if (!subscriptionExpiresAt) {
        return res.status(400).json({ success: false, message: 'Expiry date required for paid subscriptions' });
      }
      updateData.subscriptionExpiresAt = new Date(subscriptionExpiresAt);
    } else {
      // For free subscription, remove expiry date
      updateData.subscriptionExpiresAt = null;
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Subscription updated successfully', 
      user 
    });
  } catch (err) {
    console.error('Error updating user subscription:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (soft delete)
// @access  Admin only
router.delete('/:id', /* isAdmin, */ async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Soft delete by setting isActive to false
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/users/stats/summary
// @desc    Get user statistics for dashboard
// @access  Admin only
router.get('/stats/summary', /* isAdmin, */ async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = await User.countDocuments({ isActive: false });
    
    // Users registered this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: thisMonth }
    });
    
    // Recent registrations (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentUsers = await User.find({
      createdAt: { $gte: lastWeek }
    })
    .select('-password')
    .sort({ createdAt: -1 })
    .limit(5);
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsersThisMonth,
        recentUsers
      }
    });
  } catch (err) {
    console.error('Error fetching user stats:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/users/debug/sessions
// @desc    Debug endpoint to see all sessions data
// @access  Admin only
router.get('/debug/sessions', async (req, res) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Get all sessions
    const allSessions = await UserSession.find()
      .populate('userId', 'username email subscriptionType')
      .sort({ lastActivity: -1 });
    
    // Get active sessions
    const activeSessions = allSessions.filter(s => s.isActive);
    
    // Get recent sessions (within 5 minutes)
    const recentSessions = allSessions.filter(s => 
      s.isActive && s.lastActivity >= fiveMinutesAgo
    );
    
    res.json({
      success: true,
      debug: {
        timestamp: now,
        threshold: fiveMinutesAgo,
        counts: {
          total: allSessions.length,
          active: activeSessions.length,
          recent: recentSessions.length
        },
        allSessions: allSessions.map(s => ({
          _id: s._id,
          userId: s.userId?._id,
          username: s.userId?.username,
          email: s.userId?.email,
          subscriptionType: s.userId?.subscriptionType,
          isActive: s.isActive,
          loginAt: s.loginAt,
          lastActivity: s.lastActivity,
          logoutAt: s.logoutAt,
          ipAddress: s.ipAddress,
          minutesAgo: Math.round((now - s.lastActivity) / 60000)
        })),
        recentSessions: recentSessions.map(s => ({
          username: s.userId?.username,
          lastActivity: s.lastActivity,
          minutesAgo: Math.round((now - s.lastActivity) / 60000)
        }))
      }
    });
    
  } catch (err) {
    console.error('Error in debug sessions:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

module.exports = router;