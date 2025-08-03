const express = require('express');
const router = express.Router();
const Tutorial = require('../models/Tutorial');
const { isAdmin } = require('../middleware/adminAuth');

// @route   GET /api/admin/tutorials
// @desc    Get all tutorials for admin panel
// @access  Admin only
router.get('/', /* isAdmin, */ async (req, res) => {
  try {
    const { page = 1, limit = 10, category = 'all', search = '' } = req.query;
    
    let query = {};
    
    // Filter by category
    if (category !== 'all') {
      query.category = category;
    }
    
    // Search by title or description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    const tutorials = await Tutorial.find(query)
      .populate('createdBy', 'username email')
      .sort({ orderIndex: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Tutorial.countDocuments(query);
    
    res.json({
      success: true,
      tutorials,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (err) {
    console.error('Error fetching tutorials:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/tutorials/:id
// @desc    Get tutorial by ID
// @access  Admin only
router.get('/:id', /* isAdmin, */ async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id)
      .populate('createdBy', 'username email');
    
    if (!tutorial) {
      return res.status(404).json({ success: false, message: 'Tutorial not found' });
    }
    
    res.json({ success: true, tutorial });
  } catch (err) {
    console.error('Error fetching tutorial:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/admin/tutorials
// @desc    Create new tutorial
// @access  Admin only
router.post('/', /* isAdmin, */ async (req, res) => {
  try {
    const {
      title,
      description,
      youtubeUrl,
      category,
      tags,
      orderIndex
    } = req.body;

    // Validate required fields
    if (!title || !description || !youtubeUrl || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, YouTube URL, and category are required'
      });
    }

    // Extract video ID from YouTube URL
    const videoIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = youtubeUrl.match(videoIdRegex);
    
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Invalid YouTube URL format'
      });
    }

    const youtubeVideoId = match[1];

    const tutorial = new Tutorial({
      title: title.trim(),
      description: description.trim(),
      youtubeUrl,
      youtubeVideoId,
      category,
      tags: tags ? tags.map(tag => tag.trim()).filter(tag => tag) : [],
      orderIndex: orderIndex || 0,
      thumbnail: `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`,
      createdBy: req.user ? req.user.id : '507f1f77bcf86cd799439011' // Default admin ID for testing
    });

    await tutorial.save();
    
    const populatedTutorial = await Tutorial.findById(tutorial._id)
      .populate('createdBy', 'username email');

    res.status(201).json({
      success: true,
      message: 'Tutorial created successfully',
      tutorial: populatedTutorial
    });
  } catch (err) {
    console.error('Error creating tutorial:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/tutorials/:id
// @desc    Update tutorial
// @access  Admin only
router.put('/:id', /* isAdmin, */ async (req, res) => {
  try {
    const {
      title,
      description,
      youtubeUrl,
      category,
      tags,
      orderIndex,
      isActive
    } = req.body;

    const tutorial = await Tutorial.findById(req.params.id);
    
    if (!tutorial) {
      return res.status(404).json({ success: false, message: 'Tutorial not found' });
    }

    // Update fields
    if (title) tutorial.title = title.trim();
    if (description) tutorial.description = description.trim();
    if (category) tutorial.category = category;
    if (tags) tutorial.tags = tags.map(tag => tag.trim()).filter(tag => tag);
    if (orderIndex !== undefined) tutorial.orderIndex = orderIndex;
    if (isActive !== undefined) tutorial.isActive = isActive;

    // Handle YouTube URL update
    if (youtubeUrl && youtubeUrl !== tutorial.youtubeUrl) {
      const videoIdRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      const match = youtubeUrl.match(videoIdRegex);
      
      if (!match) {
        return res.status(400).json({
          success: false,
          message: 'Invalid YouTube URL format'
        });
      }

      tutorial.youtubeUrl = youtubeUrl;
      tutorial.youtubeVideoId = match[1];
      tutorial.thumbnail = `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
    }

    await tutorial.save();
    
    const updatedTutorial = await Tutorial.findById(tutorial._id)
      .populate('createdBy', 'username email');

    res.json({
      success: true,
      message: 'Tutorial updated successfully',
      tutorial: updatedTutorial
    });
  } catch (err) {
    console.error('Error updating tutorial:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/admin/tutorials/:id
// @desc    Delete tutorial
// @access  Admin only
router.delete('/:id', /* isAdmin, */ async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id);
    
    if (!tutorial) {
      return res.status(404).json({ success: false, message: 'Tutorial not found' });
    }

    await Tutorial.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Tutorial deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting tutorial:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/admin/tutorials/:id/reorder
// @desc    Update tutorial order
// @access  Admin only
router.put('/:id/reorder', /* isAdmin, */ async (req, res) => {
  try {
    const { orderIndex } = req.body;
    
    if (orderIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Order index is required'
      });
    }

    const tutorial = await Tutorial.findByIdAndUpdate(
      req.params.id,
      { orderIndex },
      { new: true }
    ).populate('createdBy', 'username email');

    if (!tutorial) {
      return res.status(404).json({ success: false, message: 'Tutorial not found' });
    }

    res.json({
      success: true,
      message: 'Tutorial order updated successfully',
      tutorial
    });
  } catch (err) {
    console.error('Error updating tutorial order:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/admin/tutorials/stats/summary
// @desc    Get tutorials statistics
// @access  Admin only
router.get('/stats/summary', /* isAdmin, */ async (req, res) => {
  try {
    const totalTutorials = await Tutorial.countDocuments();
    const activeTutorials = await Tutorial.countDocuments({ isActive: true });
    const inactiveTutorials = await Tutorial.countDocuments({ isActive: false });
    
    const categoryStats = await Tutorial.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const totalViews = await Tutorial.aggregate([
      { $group: { _id: null, total: { $sum: '$viewCount' } } }
    ]);

    const topViewedTutorials = await Tutorial.find({ isActive: true })
      .sort({ viewCount: -1 })
      .limit(5)
      .select('title viewCount youtubeVideoId');

    res.json({
      success: true,
      stats: {
        totalTutorials,
        activeTutorials,
        inactiveTutorials,
        totalViews: totalViews[0]?.total || 0,
        categoryStats,
        topViewedTutorials
      }
    });
  } catch (err) {
    console.error('Error fetching tutorial stats:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
