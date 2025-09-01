const express = require('express');
const router = express.Router();
const dailyResetService = require('../services/dailyResetService');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

/**
 * Admin routes for managing Daily Reset Service
 */

// GET /api/admin/daily-reset/status - Get service status
router.get('/status', auth, adminAuth, async (req, res) => {
    try {
        const status = dailyResetService.getStatus();
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting daily reset status:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy trạng thái reset service',
            error: error.message
        });
    }
});

// GET /api/admin/daily-reset/check-today - Check today's usage
router.get('/check-today', auth, adminAuth, async (req, res) => {
    try {
        const todayUsage = await dailyResetService.checkTodayUsage();
        
        res.json({
            success: true,
            data: todayUsage
        });
    } catch (error) {
        console.error('Error checking today usage:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể kiểm tra usage hôm nay',
            error: error.message
        });
    }
});

// POST /api/admin/daily-reset/manual - Manual reset (admin only)
router.post('/manual', auth, adminAuth, async (req, res) => {
    try {
        const { force } = req.body;
        
        console.log(`[Admin] Manual reset requested by admin: ${req.user.email}, force: ${force}`);
        
        const result = await dailyResetService.performDailyReset(force);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.skipped ? 'Reset đã được thực hiện hôm nay' : 'Reset thành công!',
                data: result
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Reset thất bại',
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error during manual reset:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thực hiện manual reset',
            error: error.message
        });
    }
});

// POST /api/admin/daily-reset/start - Start cron job
router.post('/start', auth, adminAuth, async (req, res) => {
    try {
        dailyResetService.startCronJob();
        
        res.json({
            success: true,
            message: 'Daily reset cron job đã được khởi động',
            data: dailyResetService.getStatus()
        });
    } catch (error) {
        console.error('Error starting daily reset cron:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể khởi động cron job',
            error: error.message
        });
    }
});

// POST /api/admin/daily-reset/stop - Stop cron job
router.post('/stop', auth, adminAuth, async (req, res) => {
    try {
        dailyResetService.stopCronJob();
        
        res.json({
            success: true,
            message: 'Daily reset cron job đã được dừng',
            data: dailyResetService.getStatus()
        });
    } catch (error) {
        console.error('Error stopping daily reset cron:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể dừng cron job',
            error: error.message
        });
    }
});

// GET /api/admin/daily-reset/logs - Get recent reset logs (if implemented)
router.get('/logs', auth, adminAuth, async (req, res) => {
    try {
        // For now, return service status and today's check
        const status = dailyResetService.getStatus();
        const todayUsage = await dailyResetService.checkTodayUsage();
        
        res.json({
            success: true,
            data: {
                service: status,
                todayCheck: todayUsage,
                note: 'Full logging system can be implemented later'
            }
        });
    } catch (error) {
        console.error('Error getting reset logs:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể lấy logs',
            error: error.message
        });
    }
});

module.exports = router;