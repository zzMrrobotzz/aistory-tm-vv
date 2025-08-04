const express = require('express');
const router = express.Router();
const SupportContent = require('../models/SupportContent');

// Middleware to check admin authentication (assuming you have admin middleware)
// const adminAuth = require('../middleware/adminAuth');
// router.use(adminAuth);

// @route   GET /api/admin/support-content
// @desc    Get full support content for admin editing
// @access  Admin
router.get('/', async (req, res) => {
    try {
        const supportContent = await SupportContent.getDefault();
        
        res.json({
            success: true,
            data: supportContent
        });
    } catch (error) {
        console.error('Admin - Error fetching support content:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể tải nội dung hỗ trợ',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/support-content
// @desc    Update support content
// @access  Admin
router.put('/', async (req, res) => {
    try {
        const updateData = req.body;
        
        // Add metadata
        updateData.lastUpdatedBy = req.user?.username || 'admin';
        updateData.version = (updateData.version || 0) + 1;
        
        let supportContent = await SupportContent.findOne({ isActive: true });
        
        if (!supportContent) {
            supportContent = new SupportContent(updateData);
        } else {
            Object.assign(supportContent, updateData);
        }
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Cập nhật nội dung hỗ trợ thành công',
            data: supportContent
        });
    } catch (error) {
        console.error('Admin - Error updating support content:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật nội dung hỗ trợ',
            error: error.message
        });
    }
});

// @route   POST /api/admin/support-content/faq
// @desc    Add new FAQ
// @access  Admin
router.post('/faq', async (req, res) => {
    try {
        const { question, answer, category = 'general', priority = 0 } = req.body;
        
        if (!question || !answer) {
            return res.status(400).json({
                success: false,
                message: 'Câu hỏi và câu trả lời không được để trống'
            });
        }
        
        const supportContent = await SupportContent.getDefault();
        
        supportContent.faqSection.faqs.push({
            question,
            answer,  
            category,
            priority,
            isActive: true
        });
        
        supportContent.lastUpdatedBy = req.user?.username || 'admin';
        supportContent.version += 1;
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Thêm FAQ mới thành công',
            data: supportContent.faqSection.faqs
        });
    } catch (error) {
        console.error('Admin - Error adding FAQ:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể thêm FAQ',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/support-content/faq/:faqId
// @desc    Update specific FAQ
// @access  Admin
router.put('/faq/:faqId', async (req, res) => {
    try {
        const { faqId } = req.params;
        const { question, answer, category, priority, isActive } = req.body;
        
        const supportContent = await SupportContent.getDefault();
        const faq = supportContent.faqSection.faqs.id(faqId);
        
        if (!faq) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy FAQ'
            });
        }
        
        if (question !== undefined) faq.question = question;
        if (answer !== undefined) faq.answer = answer;
        if (category !== undefined) faq.category = category;
        if (priority !== undefined) faq.priority = priority;
        if (isActive !== undefined) faq.isActive = isActive;
        
        supportContent.lastUpdatedBy = req.user?.username || 'admin';
        supportContent.version += 1;
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Cập nhật FAQ thành công',
            data: faq
        });
    } catch (error) {
        console.error('Admin - Error updating FAQ:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật FAQ',
            error: error.message
        });
    }
});

// @route   DELETE /api/admin/support-content/faq/:faqId
// @desc    Delete FAQ
// @access  Admin
router.delete('/faq/:faqId', async (req, res) => {
    try {
        const { faqId } = req.params;
        
        const supportContent = await SupportContent.getDefault();
        const faq = supportContent.faqSection.faqs.id(faqId);
        
        if (!faq) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy FAQ'
            });
        }
        
        supportContent.faqSection.faqs.pull(faqId);
        supportContent.lastUpdatedBy = req.user?.username || 'admin';
        supportContent.version += 1;
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Xóa FAQ thành công'
        });
    } catch (error) {
        console.error('Admin - Error deleting FAQ:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể xóa FAQ',
            error: error.message
        });
    }
});

// @route   POST /api/admin/support-content/quick-link
// @desc    Add new quick link
// @access  Admin
router.post('/quick-link', async (req, res) => {
    try {
        const { title, url, description, icon = '🔗' } = req.body;
        
        if (!title || !url) {
            return res.status(400).json({
                success: false,
                message: 'Tiêu đề và URL không được để trống'
            });
        }
        
        const supportContent = await SupportContent.getDefault();
        
        supportContent.quickLinks.links.push({
            title,
            url,
            description,
            icon,
            isActive: true
        });
        
        supportContent.lastUpdatedBy = req.user?.username || 'admin';
        supportContent.version += 1;
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Thêm liên kết nhanh thành công',
            data: supportContent.quickLinks.links
        });
    } catch (error) {
        console.error('Admin - Error adding quick link:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể thêm liên kết nhanh',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/support-content/contact-info
// @desc    Update contact information
// @access  Admin
router.put('/contact-info', async (req, res) => {
    try {
        const { primaryContact, contactValue, contactName, secondaryContacts } = req.body;
        
        const supportContent = await SupportContent.getDefault();
        
        if (primaryContact !== undefined) supportContent.contactInfo.primaryContact = primaryContact;
        if (contactValue !== undefined) supportContent.contactInfo.contactValue = contactValue;
        if (contactName !== undefined) supportContent.contactInfo.contactName = contactName;
        if (secondaryContacts !== undefined) supportContent.contactInfo.secondaryContacts = secondaryContacts;
        
        supportContent.lastUpdatedBy = req.user?.username || 'admin';
        supportContent.version += 1;
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Cập nhật thông tin liên hệ thành công',
            data: supportContent.contactInfo
        });
    } catch (error) {
        console.error('Admin - Error updating contact info:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật thông tin liên hệ',
            error: error.message
        });
    }
});

// @route   PUT /api/admin/support-content/announcement
// @desc    Update announcement
// @access  Admin
router.put('/announcement', async (req, res) => {
    try {
        const { isEnabled, type, title, message, expiresAt } = req.body;
        
        const supportContent = await SupportContent.getDefault();
        
        if (isEnabled !== undefined) supportContent.announcement.isEnabled = isEnabled;
        if (type !== undefined) supportContent.announcement.type = type;
        if (title !== undefined) supportContent.announcement.title = title;
        if (message !== undefined) supportContent.announcement.message = message;
        if (expiresAt !== undefined) supportContent.announcement.expiresAt = expiresAt;
        
        supportContent.lastUpdatedBy = req.user?.username || 'admin';
        supportContent.version += 1;
        
        await supportContent.save();
        
        res.json({
            success: true,
            message: 'Cập nhật thông báo thành công',
            data: supportContent.announcement
        });
    } catch (error) {
        console.error('Admin - Error updating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Không thể cập nhật thông báo',
            error: error.message
        });
    }
});

// @route   GET /api/admin/support-content/stats
// @desc    Get support content statistics
// @access  Admin
router.get('/stats', async (req, res) => {
    try {
        const supportContent = await SupportContent.getDefault();
        
        const stats = {
            totalFAQs: supportContent.faqSection.faqs.length,
            activeFAQs: supportContent.faqSection.faqs.filter(faq => faq.isActive).length,
            faqsByCategory: {
                general: supportContent.faqSection.faqs.filter(faq => faq.category === 'general' && faq.isActive).length,
                technical: supportContent.faqSection.faqs.filter(faq => faq.category === 'technical' && faq.isActive).length,
                billing: supportContent.faqSection.faqs.filter(faq => faq.category === 'billing' && faq.isActive).length,
                features: supportContent.faqSection.faqs.filter(faq => faq.category === 'features' && faq.isActive).length,
                troubleshooting: supportContent.faqSection.faqs.filter(faq => faq.category === 'troubleshooting' && faq.isActive).length
            },
            totalQuickLinks: supportContent.quickLinks.links.length,
            activeQuickLinks: supportContent.quickLinks.links.filter(link => link.isActive).length,
            secondaryContacts: supportContent.contactInfo.secondaryContacts.length,
            activeSecondaryContacts: supportContent.contactInfo.secondaryContacts.filter(contact => contact.isActive).length,
            lastUpdated: supportContent.updatedAt,
            lastUpdatedBy: supportContent.lastUpdatedBy,
            version: supportContent.version
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Admin - Error fetching support content stats:', error);
        res.status(500).json({
            success: false, 
            message: 'Không thể tải thống kê',
            error: error.message
        });
    }
});

module.exports = router;