const express = require('express');
const router = express.Router();
const Tutorial = require('../models/Tutorial');

// @route   GET /api/tutorials
// @desc    Get all active tutorials for end users
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category = 'all', limit = 20 } = req.query;
    
    let query = { isActive: true };
    
    // Filter by category
    if (category !== 'all') {
      query.category = category;
    }
    
    const tutorials = await Tutorial.find(query)
      .select('-createdBy -updatedAt -__v')
      .sort({ orderIndex: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .exec();
    
    res.json({
      success: true,
      tutorials
    });
  } catch (err) {
    console.error('Error fetching tutorials:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/tutorials/categories
// @desc    Get all tutorial categories with counts
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Tutorial.aggregate([
      { $match: { isActive: true } },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 },
          totalViews: { $sum: '$viewCount' }
        } 
      },
      { $sort: { _id: 1 } }
    ]);

    const categoryMap = {
      'basic': 'Cơ Bản',
      'advanced': 'Nâng Cao', 
      'features': 'Tính Năng',
      'troubleshooting': 'Khắc Phục Sự Cố'
    };

    const formattedCategories = categories.map(cat => ({
      key: cat._id,
      name: categoryMap[cat._id] || cat._id,
      count: cat.count,
      totalViews: cat.totalViews
    }));

    res.json({
      success: true,
      categories: formattedCategories
    });
  } catch (err) {
    console.error('Error fetching categories:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/tutorials/:id
// @desc    Get tutorial by ID and increment view count
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const tutorial = await Tutorial.findById(req.params.id)
      .select('-createdBy -updatedAt -__v');
    
    if (!tutorial || !tutorial.isActive) {
      return res.status(404).json({ success: false, message: 'Tutorial not found' });
    }

    // Increment view count
    await Tutorial.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } }
    );

    res.json({ 
      success: true, 
      tutorial: {
        ...tutorial.toObject(),
        viewCount: tutorial.viewCount + 1
      }
    });
  } catch (err) {
    console.error('Error fetching tutorial:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/tutorials/search/:query
// @desc    Search tutorials by title, description, or tags
// @access  Public
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    
    const tutorials = await Tutorial.find({
      isActive: true,
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } }
      ]
    })
    .select('-createdBy -updatedAt -__v')
    .sort({ viewCount: -1, orderIndex: 1 })
    .limit(parseInt(limit))
    .exec();
    
    res.json({
      success: true,
      tutorials,
      searchQuery: query
    });
  } catch (err) {
    console.error('Error searching tutorials:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/tutorials/popular/top
// @desc    Get most viewed tutorials
// @access  Public
router.get('/popular/top', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const tutorials = await Tutorial.find({ isActive: true })
      .select('-createdBy -updatedAt -__v')
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .exec();
    
    res.json({
      success: true,
      tutorials
    });
  } catch (err) {
    console.error('Error fetching popular tutorials:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/tutorials/recent/latest
// @desc    Get recently added tutorials
// @access  Public
router.get('/recent/latest', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const tutorials = await Tutorial.find({ isActive: true })
      .select('-createdBy -updatedAt -__v')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .exec();
    
    res.json({
      success: true,
      tutorials
    });
  } catch (err) {
    console.error('Error fetching recent tutorials:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
