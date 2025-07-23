const express = require('express');
const router = express.Router();
const CreditPackage = require('../models/CreditPackage');
const { createAuditLog } = require('../utils/auditLogger');

// GET /api/admin/packages - Get all packages for admin management
router.get('/packages', async (req, res) => {
    try {
        const packages = await CreditPackage.find({}).sort({ 
            durationType: 1, // days first, then months
            durationValue: 1, // sort by duration value
            price: 1 // then by price
        });

        return res.json({
            success: true,
            packages: packages.map(pkg => ({
                _id: pkg._id,
                planId: pkg.planId,
                name: pkg.name,
                description: pkg.description,
                price: pkg.price,
                durationType: pkg.durationType || 'months',
                durationValue: pkg.durationValue || pkg.durationMonths || 1,
                durationMonths: pkg.durationMonths, // For backward compatibility
                isPopular: pkg.isPopular,
                isActive: pkg.isActive,
                createdAt: pkg.createdAt,
                updatedAt: pkg.updatedAt
            }))
        });

    } catch (error) {
        console.error('Get admin packages error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch packages'
        });
    }
});

// POST /api/admin/packages - Create new package
router.post('/packages', async (req, res) => {
    try {
        const {
            planId,
            name,
            description,
            price,
            durationType, // 'days' or 'months'
            durationValue, // number
            isPopular,
            isActive
        } = req.body;

        // Validation
        if (!planId || !name || !price || !durationType || !durationValue) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: planId, name, price, durationType, durationValue'
            });
        }

        if (!['days', 'months'].includes(durationType)) {
            return res.status(400).json({
                success: false,
                error: 'durationType must be "days" or "months"'
            });
        }

        if (price < 0 || durationValue <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Price and duration must be positive numbers'
            });
        }

        // Check if planId already exists
        const existingPackage = await CreditPackage.findOne({ planId });
        if (existingPackage) {
            return res.status(400).json({
                success: false,
                error: `Package with planId "${planId}" already exists`
            });
        }

        // Create new package
        const newPackage = new CreditPackage({
            planId: planId.trim(),
            name: name.trim(),
            description: description?.trim() || '',
            price: parseInt(price),
            durationType,
            durationValue: parseInt(durationValue),
            durationMonths: durationType === 'months' ? parseInt(durationValue) : null, // Backward compatibility
            isPopular: Boolean(isPopular),
            isActive: isActive !== false // Default to true
        });

        await newPackage.save();

        await createAuditLog('PACKAGE_CREATED', `Admin created package: ${newPackage.name} (${newPackage.planId})`);

        console.log(`✅ New package created: ${newPackage.name} - ${newPackage.price} VND - ${newPackage.durationValue} ${newPackage.durationType}`);

        return res.status(201).json({
            success: true,
            message: 'Package created successfully',
            package: {
                _id: newPackage._id,
                planId: newPackage.planId,
                name: newPackage.name,
                description: newPackage.description,
                price: newPackage.price,
                durationType: newPackage.durationType,
                durationValue: newPackage.durationValue,
                isPopular: newPackage.isPopular,
                isActive: newPackage.isActive
            }
        });

    } catch (error) {
        console.error('Create package error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create package',
            details: error.message
        });
    }
});

// PUT /api/admin/packages/:id - Update package
router.put('/packages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            price,
            durationType,
            durationValue,
            isPopular,
            isActive
        } = req.body;

        const package = await CreditPackage.findById(id);
        if (!package) {
            return res.status(404).json({
                success: false,
                error: 'Package not found'
            });
        }

        // Update fields if provided
        if (name) package.name = name.trim();
        if (description !== undefined) package.description = description.trim();
        if (price !== undefined) package.price = parseInt(price);
        if (durationType && ['days', 'months'].includes(durationType)) {
            package.durationType = durationType;
        }
        if (durationValue !== undefined) {
            package.durationValue = parseInt(durationValue);
            // Update backward compatibility field
            if (package.durationType === 'months') {
                package.durationMonths = parseInt(durationValue);
            }
        }
        if (isPopular !== undefined) package.isPopular = Boolean(isPopular);
        if (isActive !== undefined) package.isActive = Boolean(isActive);

        await package.save();

        await createAuditLog('PACKAGE_UPDATED', `Admin updated package: ${package.name} (${package.planId})`);

        console.log(`✅ Package updated: ${package.name} - ${package.price} VND - ${package.durationValue} ${package.durationType}`);

        return res.json({
            success: true,
            message: 'Package updated successfully',
            package: {
                _id: package._id,
                planId: package.planId,
                name: package.name,
                description: package.description,
                price: package.price,
                durationType: package.durationType,
                durationValue: package.durationValue,
                isPopular: package.isPopular,
                isActive: package.isActive
            }
        });

    } catch (error) {
        console.error('Update package error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update package',
            details: error.message
        });
    }
});

// DELETE /api/admin/packages/:id - Delete package (soft delete by setting isActive = false)
router.delete('/packages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { hardDelete } = req.query; // ?hardDelete=true for permanent deletion

        const package = await CreditPackage.findById(id);
        if (!package) {
            return res.status(404).json({
                success: false,
                error: 'Package not found'
            });
        }

        if (hardDelete === 'true') {
            // Permanent deletion
            await CreditPackage.findByIdAndDelete(id);
            await createAuditLog('PACKAGE_DELETED', `Admin permanently deleted package: ${package.name} (${package.planId})`);
            console.log(`🗑️ Package permanently deleted: ${package.name}`);
        } else {
            // Soft delete - just deactivate
            package.isActive = false;
            await package.save();
            await createAuditLog('PACKAGE_DEACTIVATED', `Admin deactivated package: ${package.name} (${package.planId})`);
            console.log(`⏸️ Package deactivated: ${package.name}`);
        }

        return res.json({
            success: true,
            message: hardDelete === 'true' ? 'Package permanently deleted' : 'Package deactivated successfully'
        });

    } catch (error) {
        console.error('Delete package error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete package',
            details: error.message
        });
    }
});

// POST /api/admin/packages/:id/toggle - Toggle package active status
router.post('/packages/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;

        const package = await CreditPackage.findById(id);
        if (!package) {
            return res.status(404).json({
                success: false,
                error: 'Package not found'
            });
        }

        package.isActive = !package.isActive;
        await package.save();

        const action = package.isActive ? 'activated' : 'deactivated';
        await createAuditLog('PACKAGE_TOGGLED', `Admin ${action} package: ${package.name} (${package.planId})`);

        console.log(`🔄 Package ${action}: ${package.name}`);

        return res.json({
            success: true,
            message: `Package ${action} successfully`,
            isActive: package.isActive
        });

    } catch (error) {
        console.error('Toggle package error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to toggle package status',
            details: error.message
        });
    }
});

module.exports = router;