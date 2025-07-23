const express = require('express');
const router = express.Router();
const CreditPackage = require('../models/CreditPackage');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/packages - Lấy tất cả gói cước active cho frontend
router.get('/', async (req, res) => {
    try {
        // Chỉ lấy packages active cho frontend public
        const packages = await CreditPackage.find({ isActive: true }).sort({ 
            durationType: 1, // days first, then months
            durationValue: 1, // sort by duration value
            price: 1 // then by price
        });
        
        console.log(`📦 Public packages API: Found ${packages.length} active packages`);
        
        res.json({ success: true, packages });
    } catch (error) {
        console.error('Public packages API error:', error);
        res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
    }
});

// POST /api/packages - Tạo gói cước mới
router.post('/', async (req, res) => {
    try {
        const { planId, name, description, price, durationMonths, isPopular, isActive } = req.body;
        const newPackage = new CreditPackage({ 
            planId,
            name,
            description,
            price,
            durationMonths,
            isPopular: isPopular || false,
            isActive: isActive !== undefined ? isActive : true,
        });
        await newPackage.save();
        await createAuditLog('CREATE_PACKAGE', `Gói cước "${name}" đã được tạo.`);
        res.status(201).json({ success: true, package: newPackage });
    } catch (error) {
        res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ', details: error.message });
    }
});

// PUT /api/packages/:id - Cập nhật gói cước
router.put('/:id', async (req, res) => {
    try {
        const { planId, name, description, price, durationMonths, isPopular, isActive } = req.body;
        const updatedPackage = await CreditPackage.findByIdAndUpdate(
            req.params.id,
            { planId, name, description, price, durationMonths, isPopular, isActive },
            { new: true, runValidators: true }
        );
        if (!updatedPackage) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy gói cước' });
        }
        await createAuditLog('UPDATE_PACKAGE', `Gói cước "${updatedPackage.name}" đã được cập nhật.`);
        res.json({ success: true, package: updatedPackage });
    } catch (error) {
        res.status(400).json({ success: false, error: 'Dữ liệu không hợp lệ', details: error.message });
    }
});

// DELETE /api/packages/:id - Xóa gói cước
router.delete('/:id', async (req, res) => {
    try {
        const deletedPackage = await CreditPackage.findByIdAndDelete(req.params.id);
        if (!deletedPackage) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy gói cước' });
        }
        await createAuditLog('DELETE_PACKAGE', `Gói cước "${deletedPackage.name}" đã bị xóa.`);
        res.json({ success: true, message: 'Gói cước đã được xóa' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Lỗi máy chủ' });
    }
});

module.exports = router; 