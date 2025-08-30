const express = require('express');
const router = express.Router();
const RequestTracking = require('../services/requestTracking');

// @route   POST /api/requests/check-and-track
// @desc    Check if user can make request and track it if yes
// @access  Protected (requires auth)
router.post('/check-and-track', async (req, res) => {
    try {
        const userId = req.user._id;
        const { action } = req.body;
        
        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Action is required'
            });
        }
        
        const result = await RequestTracking.checkAndIncrementRequest(userId, action);
        
        if (result.blocked) {
            return res.status(429).json({
                success: false,
                blocked: true,
                message: result.message,
                usage: result.usage
            });
        }
        
        res.json({
            success: true,
            message: result.message,
            usage: result.usage,
            warning: result.warning
        });
        
    } catch (error) {
        console.error('Error in check-and-track:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// @route   GET /api/requests/status
// @desc    Get current user's request status
// @access  Protected (requires auth)
router.get('/status', async (req, res) => {
    try {
        const userId = req.user._id;
        const record = await RequestTracking.getTodayRecord(userId);
        
        res.json({
            success: true,
            usage: {
                current: record.requestCount,
                limit: record.dailyLimit,
                remaining: record.getRemainingRequests(),
                percentage: record.getUsagePercentage(),
                lastRequestAt: record.lastRequestAt
            }
        });
        
    } catch (error) {
        console.error('Error getting request status:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting request status',
            error: error.message
        });
    }
});

// @route   GET /api/requests/history
// @desc    Get user's request history
// @access  Protected (requires auth)
router.get('/history', async (req, res) => {
    try {
        const userId = req.user._id;
        const { days = 7 } = req.query;
        
        const records = await RequestTracking.getUserHistory(userId, parseInt(days));
        
        // Calculate stats
        const totalRequests = records.reduce((sum, record) => sum + record.requestCount, 0);
        const avgPerDay = records.length > 0 ? Math.round(totalRequests / records.length) : 0;
        const daysWithActivity = records.filter(record => record.requestCount > 0).length;
        
        res.json({
            success: true,
            data: {
                records: records.map(record => ({
                    date: record.date,
                    requestCount: record.requestCount,
                    percentage: record.getUsagePercentage(),
                    lastRequestAt: record.lastRequestAt
                })),
                stats: {
                    totalRequests,
                    avgPerDay,
                    daysWithActivity,
                    totalDays: records.length
                }
            }
        });
        
    } catch (error) {
        console.error('Error getting request history:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting request history',
            error: error.message
        });
    }
});

// @route   POST /api/requests/reset-daily
// @desc    Reset daily limit (admin only - for testing)
// @access  Protected (requires auth)
router.post('/reset-daily', async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date().toISOString().split('T')[0];
        
        await RequestTracking.findOneAndUpdate(
            { userId, date: today },
            { 
                requestCount: 0, 
                requests: [], 
                lastRequestAt: new Date() 
            },
            { upsert: true }
        );
        
        res.json({
            success: true,
            message: 'Daily request count reset to 0'
        });
        
    } catch (error) {
        console.error('Error resetting daily requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting daily requests',
            error: error.message
        });
    }
});

module.exports = router;