const express = require('express');
const router = express.Router();
const SupportContent = require('../models/SupportContent');

// @route   GET /api/support-content
// @desc    Get current support content for frontend display
// @access  Public (no auth required)
router.get('/', async (req, res) => {
    try {
        let supportContent = await SupportContent.getDefault();
        
        // Return only active content and filter out inactive items
        const responseData = {
            supportTitle: supportContent.supportTitle,
            supportDescription: supportContent.supportDescription,
            contactInfo: {
                primaryContact: supportContent.contactInfo.primaryContact,
                contactValue: supportContent.contactInfo.contactValue,
                contactName: supportContent.contactInfo.contactName,
                secondaryContacts: supportContent.getActiveContacts()
            },
            faqSection: supportContent.faqSection.isEnabled ? {
                title: supportContent.faqSection.title,
                faqs: supportContent.getActiveFAQs()
            } : null,
            contactGuidelines: supportContent.contactGuidelines.isEnabled ? {
                title: supportContent.contactGuidelines.title,
                guidelines: supportContent.contactGuidelines.guidelines.filter(g => g.isActive)
            } : null,
            supportHours: supportContent.supportHours.isEnabled ? {
                timezone: supportContent.supportHours.timezone,
                schedule: supportContent.supportHours.schedule.filter(s => s.isActive)
            } : null,
            quickLinks: supportContent.quickLinks.isEnabled ? {
                title: supportContent.quickLinks.title,
                links: supportContent.getActiveQuickLinks()
            } : null,
            announcement: supportContent.announcement.isEnabled && 
                         (!supportContent.announcement.expiresAt || supportContent.announcement.expiresAt > new Date()) ? 
                         supportContent.announcement : null,
            styling: supportContent.styling
        };

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Error fetching support content:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải thông tin hỗ trợ',
            error: error.message
        });
    }
});

// @route   GET /api/support-content/faq/:category
// @desc    Get FAQs by category
// @access  Public
router.get('/faq/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const supportContent = await SupportContent.getDefault();
        
        if (!supportContent.faqSection.isEnabled) {
            return res.json({
                success: true,
                data: []
            });
        }

        const faqs = supportContent.getActiveFAQs(category);
        
        res.json({
            success: true,
            data: faqs
        });
    } catch (error) {
        console.error('Error fetching FAQ by category:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải câu hỏi thường gặp',
            error: error.message
        });
    }
});

module.exports = router;