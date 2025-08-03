const mongoose = require('mongoose');

const tutorialSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  youtubeUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // Validate YouTube URL format
        return /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(v);
      },
      message: 'Please enter a valid YouTube URL'
    }
  },
  youtubeVideoId: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['basic', 'advanced', 'features', 'troubleshooting'],
    default: 'basic'
  },
  tags: [{
    type: String,
    trim: true
  }],
  orderIndex: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  thumbnail: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: ''
  },
  viewCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
tutorialSchema.index({ category: 1, orderIndex: 1 });
tutorialSchema.index({ isActive: 1, orderIndex: 1 });
tutorialSchema.index({ tags: 1 });

// Extract YouTube video ID from URL before saving
tutorialSchema.pre('save', function(next) {
  if (this.isModified('youtubeUrl')) {
    const videoId = this.extractVideoId(this.youtubeUrl);
    if (videoId) {
      this.youtubeVideoId = videoId;
      this.thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  }
  next();
});

// Method to extract YouTube video ID from URL
tutorialSchema.methods.extractVideoId = function(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

// Static method to get tutorials by category
tutorialSchema.statics.getByCategory = function(category, isActive = true) {
  return this.find({ 
    category, 
    isActive 
  }).sort({ orderIndex: 1, createdAt: -1 });
};

// Static method to increment view count
tutorialSchema.statics.incrementViewCount = function(tutorialId) {
  return this.findByIdAndUpdate(
    tutorialId,
    { $inc: { viewCount: 1 } },
    { new: true }
  );
};

module.exports = mongoose.model('Tutorial', tutorialSchema);
