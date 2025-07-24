const express = require('express');
const router = express.Router();
const CreditPackage = require('../models/CreditPackage');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/packages/debug - Debug endpoint to check packages in database
router.get('/debug', async (req, res) => {
    try {
        const allPackages = await CreditPackage.find({});
        const activePackages = await CreditPackage.find({ 
            $or: [
                { isActive: true },
                { isActive: { $exists: false } }
            ]
        });
        
        console.log('📊 Package Debug Info:');
        console.log(`- Total packages in DB: ${allPackages.length}`);
        console.log(`- Active packages: ${activePackages.length}`);
        
        res.json({
            success: true,
            debug: {
                totalPackages: allPackages.length,
                activePackages: activePackages.length,
                allPackages: allPackages.map(p => ({
                    planId: p.planId,
                    name: p.name,
                    price: p.price,
                    isActive: p.isActive
                })),
                activePackagesFormatted: activePackages.map(p => ({
                    planId: p.planId,
                    name: p.name,
                    price: p.price,
                    durationType: p.durationType || 'months',
                    durationValue: p.durationValue || p.durationMonths || 1,
                    isActive: p.isActive !== false
                }))
            }
        });
    } catch (error) {
        console.error('❌ Package debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/packages - Lấy tất cả gói cước active cho frontend
router.get('/', async (req, res) => {
    try {
        // Lấy tất cả packages active, bao gồm cả isActive undefined (mặc định true)
        let packages = await CreditPackage.find({ 
            $or: [
                { isActive: true },
                { isActive: { $exists: false } } // Packages cũ không có field isActive
            ]
        }).sort({ price: 1 });
        
        console.log(`📦 Public packages API: Found ${packages.length} active packages`);
        
        // Nếu không có packages nào, tạo default packages
        if (packages.length === 0) {
            console.warn('⚠️ No packages found in database! Creating default packages...');
            const defaultPackages = [
                {
                    planId: 'monthly_299k',
                    name: 'Monthly Plan',
                    description: 'Gói tháng với tất cả tính năng AI',
                    price: 299000,
                    durationType: 'months',
                    durationValue: 1,
                    durationMonths: 1,
                    isPopular: true,
                    isActive: true
                },
                {
                    planId: 'lifetime_2m99',
                    name: 'Lifetime Plan',
                    description: 'Gói vĩnh viễn với tất cả tính năng AI',
                    price: 2990000,
                    durationType: 'months',
                    durationValue: 999,
                    durationMonths: 999,
                    isPopular: false,
                    isActive: true
                }
            ];
            
            try {
                for (const pkg of defaultPackages) {
                    const existingPackage = await CreditPackage.findOne({ planId: pkg.planId });
                    if (!existingPackage) {
                        const newPackage = new CreditPackage(pkg);
                        await newPackage.save();
                        console.log(`✅ Created default package: ${pkg.planId}`);
                    }
                }
                
                // Reload packages after creation
                packages = await CreditPackage.find({ 
                    $or: [
                        { isActive: true },
                        { isActive: { $exists: false } }
                    ]
                }).sort({ price: 1 });
                
                console.log(`📦 After creating defaults: ${packages.length} packages available`);
            } catch (createError) {
                console.error('❌ Error creating default packages:', createError);
            }
        }
        
        if (packages.length > 0) {
            console.log('📦 Package list:', packages.map(p => `${p.planId} (${p.name}) - ${p.price}VND`).join(', '));
        } else {
            console.warn('⚠️ Still no packages available after attempting to create defaults');
        }
        
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
        
        console.log(`📦 Returning ${formattedPackages.length} formatted packages to frontend`);
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