const express = require('express');
const router = express.Router();
const CreditPackage = require('../models/CreditPackage');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/packages - Lấy tất cả gói cước active cho frontend
router.get('/', async (req, res) => {
    try {
        // Lấy tất cả packages active, bao gồm cả isActive undefined (mặc định true)
        const packages = await CreditPackage.find({ 
            $or: [
                { isActive: true },
                { isActive: { $exists: false } } // Packages cũ không có field isActive
            ]
        }).sort({ price: 1 });
        
        console.log(`📦 Public packages API: Found ${packages.length} active packages`);
        
        // Format packages để đảm bảo backward compatibility
        const formattedPackages = packages.map(pkg => ({
            _id: pkg._id,
            planId: pkg.planId,
            name: pkg.name,
            description: pkg.description || '',
            price: pkg.price,
            durationType: pkg.durationType || 'months',
            durationValue: pkg.durationValue || pkg.durationMonths || 1,
            durationMonths: pkg.durationMonths, // Backward compatibility
            isPopular: pkg.isPopular || false,
            isActive: pkg.isActive !== false, // Default to true if undefined
            createdAt: pkg.createdAt,
            updatedAt: pkg.updatedAt
        }));
        
        res.json({ success: true, packages: formattedPackages });
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