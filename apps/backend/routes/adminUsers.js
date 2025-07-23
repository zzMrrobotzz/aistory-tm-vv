const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin } = require('../middleware/adminAuth');

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
    
    if (!subscriptionType || !['free', 'monthly', 'lifetime'].includes(subscriptionType)) {
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