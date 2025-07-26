const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  subscriptionType: {
    type: String,
    default: 'free',
    // Removed enum restriction to allow flexible subscription types including trial packages
  },
  subscriptionExpiresAt: {
    type: Date,
    // Only set for monthly subscriptions, lifetime = far future date
  },
  remainingCredits: {
    type: Number,
    default: 1000,
    // Note: Credits kept for display purposes only, subscription-based access
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  usageStats: {
    totalApiCalls: {
      type: Number,
      default: 0
    },
    storiesGenerated: {
      type: Number,
      default: 0
    },
    imagesGenerated: {
      type: Number,
      default: 0
    },
    textRewritten: {
      type: Number,
      default: 0
    },
    videosCreated: {
      type: Number,
      default: 0
    },
    favoriteModule: {
      type: String,
      default: 'Viết Truyện'
    },
    lastActiveDate: {
      type: Date,
      default: Date.now
    },
    dailyUsage: [{
      date: Date,
      apiCalls: {
        type: Number,
        default: 0
      },
      modules: {
        type: Object,
        default: {}
      }
    }],
    moduleUsage: {
      type: Object,
      default: {}
    }
  },
});

const bcrypt = require('bcryptjs');

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 