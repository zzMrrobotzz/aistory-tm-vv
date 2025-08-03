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
    // Get a count of total sessions, active sessions, and recent sessions
    const totalSessions = await UserSession.countDocuments();
    const activeSessions = await UserSession.countDocuments({ isActive: true });
    
    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = new Date();
    const recentSessions = await UserSession.countDocuments({
      isActive: true,
      lastActivity: { $gte: new Date(now.getTime() - FIVE_MINUTES) }
    });

    // Get some sample sessions for debugging
    const sampleSessions = await UserSession.find({ isActive: true })
      .populate('userId', 'username email')
      .sort({ lastActivity: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      message: 'Test endpoint working',
      debug: {
        totalSessions,
        activeSessions,
        recentSessions,
        userSessionModel: !!UserSession,
        sampleSessions: sampleSessions.map(s => ({
          username: s.userId?.username || 'Unknown',
          lastActivity: s.lastActivity,
          loginAt: s.loginAt,
          isActive: s.isActive,
          timeSinceActivity: Math.round((now - new Date(s.lastActivity)) / 1000 / 60) + ' minutes'
        }))
      },
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
    
    console.log(`🔍 Fetching online users at ${now.toISOString()}`);
    console.log(`🕐 Looking for sessions active since ${new Date(now.getTime() - FIVE_MINUTES).toISOString()}`);
    
    // First get all active sessions within the time window
    const activeSessions = await UserSession.find({
      isActive: true,
      lastActivity: { $gte: new Date(now.getTime() - FIVE_MINUTES) }
    }).populate('userId').lean();

    console.log(`📊 Found ${activeSessions.length} active sessions`);

    // Filter out sessions where user population failed and log any issues
    const validSessions = activeSessions.filter(session => {
      if (!session.userId) {
        console.warn(`⚠️ Session ${session._id} has invalid userId reference`);
        return false;
      }
      return true;
    });

    console.log(`✅ ${validSessions.length} sessions have valid user references`);

    // Chuyển đổi dữ liệu trả về cho frontend
    const onlineUsers = validSessions.map(session => ({
      userId: session.userId._id,
      username: session.userId.username,
      email: session.userId.email,
      subscriptionType: session.userId.subscriptionType || 'free',
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
      totalSessions: validSessions.length,
      bySubscription: {
        free: onlineUsers.filter(u => u.subscriptionType === 'free').length,
        monthly: onlineUsers.filter(u => u.subscriptionType === 'monthly').length,
        lifetime: onlineUsers.filter(u => u.subscriptionType === 'lifetime').length
      },
      averageSessionTime: validSessions.length > 0 ? Math.round(validSessions.reduce((sum, s) => sum + (now - new Date(s.loginAt)), 0) / validSessions.length) : 0
    };

    console.log(`📈 Online users stats:`, stats);

    res.json({
      success: true,
      onlineUsers,
      stats,
      lastUpdated: now
    });
  } catch (err) {
    console.error('❌ Error fetching online users:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching online users', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
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

    console.log(`🔍 Fetching online stats at ${now.toISOString()}`);

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
    }).lean();

    const avgSessionDuration = activeSessions.length > 0 ? 
      activeSessions.reduce((acc, session) => {
        return acc + (now.getTime() - new Date(session.loginAt).getTime());
      }, 0) / activeSessions.length : 0;

    const stats = {
      currentOnline,
      activeLastHour,
      activeLast24Hours,
      peakOnlineToday,
      avgSessionDuration: Math.round(avgSessionDuration / 1000 / 60), // minutes
      totalActiveSessions: activeSessions.length
    };

    console.log(`📈 Online stats:`, stats);

    res.json({
      success: true,
      stats,
      timestamp: now
    });

  } catch (err) {
    console.error('❌ Error fetching online stats:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching online stats', 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users for admin panel
// @access  Admin only (temporarily bypassed for demo)
router.get('/', /* isAdmin, */ async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
    
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
    
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      users,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
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

module.exports = router;