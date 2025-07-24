const express = require('express');
const router = express.Router();
const AccountBlock = require('../models/AccountBlock');
const DeviceFingerprint = require('../models/DeviceFingerprint');
const UserSession = require('../models/UserSession');
const User = require('../models/User');
const { createAuditLog } = require('../utils/auditLogger');

// @route   GET /api/admin/anti-sharing/stats
// @desc    Get anti-sharing statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Loading anti-sharing statistics...');

    // Block statistics
    const totalBlocks = await AccountBlock.countDocuments();
    const activeBlocks = await AccountBlock.countDocuments({ status: 'ACTIVE' });
    const appealsPending = await AccountBlock.countDocuments({ 
      'appealInfo.appealStatus': 'PENDING' 
    });

    // Device statistics
    const totalDevices = await DeviceFingerprint.countDocuments();
    const activeSessions = await UserSession.countDocuments({ isActive: true });

    // Suspicious accounts (sharing score >= 60)
    const suspiciousAccounts = await AccountBlock.countDocuments({
      sharingScore: { $gte: 60 },
      status: { $in: ['ACTIVE', 'EXPIRED'] }
    });

    // Average sharing score
    const avgScoreResult = await AccountBlock.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$sharingScore' } } }
    ]);
    const averageSharingScore = avgScoreResult[0]?.avgScore || 0;

    // Blocks today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const blocksToday = await AccountBlock.countDocuments({
      blockedAt: { $gte: todayStart }
    });

    const stats = {
      totalBlocks,
      activeBlocks,
      appealsPending,
      suspiciousAccounts,
      totalDevices,
      activeSessions,
      averageSharingScore: Math.round(averageSharingScore * 10) / 10,
      blocksToday
    };

    console.log('✅ Anti-sharing stats loaded:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error loading anti-sharing stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load anti-sharing statistics'
    });
  }
});

// @route   GET /api/admin/anti-sharing/blocks
// @desc    Get all blocked accounts
router.get('/blocks', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    console.log('📋 Loading blocked accounts...');

    // Build query
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { userId: { $regex: search, $options: 'i' } }
      ];
    }

    const blocks = await AccountBlock.find(query)
      .sort({ blockedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await AccountBlock.countDocuments(query);

    console.log(`✅ Loaded ${blocks.length} blocked accounts`);

    res.json({
      success: true,
      blocks,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total
      }
    });
  } catch (error) {
    console.error('❌ Error loading blocked accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load blocked accounts'
    });
  }
});

// @route   GET /api/admin/anti-sharing/devices
// @desc    Get all device fingerprints
router.get('/devices', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, active } = req.query;
    
    console.log('📱 Loading device fingerprints...');

    // Build query
    const query = {};
    if (userId) {
      query.userId = userId;
    }
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const devices = await DeviceFingerprint.find(query)
      .sort({ lastSeen: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await DeviceFingerprint.countDocuments(query);

    console.log(`✅ Loaded ${devices.length} device fingerprints`);

    res.json({
      success: true,
      devices,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total
      }
    });
  } catch (error) {
    console.error('❌ Error loading device fingerprints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load device fingerprints'
    });
  }
});

// @route   GET /api/admin/anti-sharing/sessions
// @desc    Get all user sessions
router.get('/sessions', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, active } = req.query;
    
    console.log('🔐 Loading user sessions...');

    // Build query
    const query = {};
    if (userId) {
      query.userId = userId;
    }
    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const sessions = await UserSession.find(query)
      .sort({ lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await UserSession.countDocuments(query);

    console.log(`✅ Loaded ${sessions.length} user sessions`);

    res.json({
      success: true,
      sessions,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total
      }
    });
  } catch (error) {
    console.error('❌ Error loading user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load user sessions'
    });
  }
});

// @route   POST /api/admin/anti-sharing/blocks/:id/unblock
// @desc    Manually unblock an account
router.post('/blocks/:id/unblock', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Manual admin unblock' } = req.body;
    
    console.log(`🔓 Manually unblocking account: ${id}`);

    const block = await AccountBlock.findById(id);
    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'Block record not found'
      });
    }

    // Update block status
    block.status = 'UNBLOCKED';
    block.adminActions.push({
      adminUser: 'ADMIN', // TODO: Get actual admin user from session
      action: 'UNBLOCKED',
      notes: reason
    });
    await block.save();

    // Reactivate user account
    await User.findByIdAndUpdate(block.userId, {
      isActive: true
    });

    // Create audit log
    await createAuditLog('ACCOUNT_UNBLOCKED', 
      `Admin manually unblocked user ${block.username} (ID: ${block.userId}). Reason: ${reason}`
    );

    console.log(`✅ Account ${block.username} successfully unblocked`);

    res.json({
      success: true,
      message: 'Account unblocked successfully'
    });
  } catch (error) {
    console.error('❌ Error unblocking account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unblock account'
    });
  }
});

// @route   POST /api/admin/anti-sharing/blocks/:id/review-appeal
// @desc    Review an appeal for blocked account
router.post('/blocks/:id/review-appeal', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body;
    
    console.log(`⚖️ Reviewing appeal for block: ${id}, approved: ${approved}`);

    const block = await AccountBlock.findById(id);
    if (!block) {
      return res.status(404).json({
        success: false,
        message: 'Block record not found'
      });
    }

    if (!block.appealInfo || block.appealInfo.appealStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'No pending appeal found for this block'
      });
    }

    // Update appeal information
    block.appealInfo.appealStatus = approved ? 'APPROVED' : 'REJECTED';
    block.appealInfo.reviewedBy = 'ADMIN'; // TODO: Get actual admin user from session
    block.appealInfo.reviewedAt = new Date();
    block.appealInfo.reviewNotes = notes;

    // If approved, unblock the account
    if (approved) {
      block.status = 'UNBLOCKED';
      
      // Reactivate user account
      await User.findByIdAndUpdate(block.userId, {
        isActive: true
      });
    }

    // Add admin action
    block.adminActions.push({
      adminUser: 'ADMIN',
      action: 'APPEAL_REVIEWED',
      notes: `Appeal ${approved ? 'approved' : 'rejected'}. ${notes || ''}`
    });

    await block.save();

    // Create audit log
    await createAuditLog('APPEAL_REVIEWED', 
      `Admin ${approved ? 'approved' : 'rejected'} appeal for user ${block.username} (ID: ${block.userId}). Notes: ${notes || 'None'}`
    );

    console.log(`✅ Appeal ${approved ? 'approved' : 'rejected'} for ${block.username}`);

    res.json({
      success: true,
      message: `Appeal ${approved ? 'approved' : 'rejected'} successfully`
    });
  } catch (error) {
    console.error('❌ Error reviewing appeal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review appeal'
    });
  }
});

// @route   POST /api/admin/anti-sharing/devices/:id/verify
// @desc    Manually verify a device as legitimate
router.post('/devices/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verified = true } = req.body;
    
    console.log(`🔍 ${verified ? 'Verifying' : 'Unverifying'} device: ${id}`);

    const device = await DeviceFingerprint.findByIdAndUpdate(
      id,
      { isVerified: verified },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Create audit log
    await createAuditLog('DEVICE_VERIFIED', 
      `Admin ${verified ? 'verified' : 'unverified'} device ${device.deviceName} for user ${device.username}`
    );

    console.log(`✅ Device ${device.deviceName} ${verified ? 'verified' : 'unverified'}`);

    res.json({
      success: true,
      message: `Device ${verified ? 'verified' : 'unverified'} successfully`,
      device
    });
  } catch (error) {
    console.error('❌ Error verifying device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify device'
    });
  }
});

// @route   POST /api/admin/anti-sharing/sessions/:id/terminate
// @desc    Manually terminate a user session
router.post('/sessions/:id/terminate', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Manual admin termination' } = req.body;
    
    console.log(`🚪 Terminating session: ${id}`);

    const session = await UserSession.findByIdAndUpdate(
      id,
      {
        isActive: false,
        logoutAt: new Date(),
        logoutReason: 'FORCE_LOGOUT'
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Create audit log
    await createAuditLog('SESSION_TERMINATED', 
      `Admin terminated session for user ${session.username}. Reason: ${reason}`
    );

    console.log(`✅ Session terminated for ${session.username}`);

    res.json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    console.error('❌ Error terminating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to terminate session'
    });
  }
});

// @route   GET /api/admin/anti-sharing/user/:userId/overview
// @desc    Get comprehensive anti-sharing overview for a specific user
router.get('/user/:userId/overview', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`👤 Loading anti-sharing overview for user: ${userId}`);

    // Get user info
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all blocks for this user
    const blocks = await AccountBlock.find({ userId }).sort({ blockedAt: -1 });

    // Get all devices for this user
    const devices = await DeviceFingerprint.find({ userId }).sort({ lastSeen: -1 });

    // Get recent sessions for this user
    const sessions = await UserSession.find({ userId })
      .sort({ lastActivity: -1 })
      .limit(10);

    // Calculate user risk score
    const currentActiveBlocks = blocks.filter(b => b.status === 'ACTIVE');
    const totalSuspiciousActivity = devices.reduce((sum, device) => {
      return sum + device.suspiciousActivity.rapidLocationChanges +
                   device.suspiciousActivity.unusualUsageHours +
                   device.suspiciousActivity.simultaneousActivity;
    }, 0);

    const riskScore = Math.min(100, 
      (currentActiveBlocks.length * 40) +
      (totalSuspiciousActivity * 5) +
      (devices.length > 3 ? 20 : 0) +
      (sessions.filter(s => s.isActive).length > 2 ? 15 : 0)
    );

    const overview = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        subscriptionType: user.subscriptionType,
        isActive: user.isActive
      },
      riskScore,
      summary: {
        totalBlocks: blocks.length,
        activeBlocks: currentActiveBlocks.length,
        totalDevices: devices.length,
        activeDevices: devices.filter(d => d.isActive).length,
        activeSessions: sessions.filter(s => s.isActive).length,
        totalSuspiciousActivity
      },
      blocks,
      devices,
      recentSessions: sessions
    };

    console.log(`✅ Anti-sharing overview loaded for ${user.username}, risk score: ${riskScore}`);

    res.json({
      success: true,
      overview
    });
  } catch (error) {
    console.error('❌ Error loading user anti-sharing overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load user overview'
    });
  }
});

module.exports = router;