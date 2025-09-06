const mongoose = require('mongoose');

const FeatureSettingsSchema = new mongoose.Schema({
  settingKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  settingValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  settingType: {
    type: String,
    enum: ['number', 'string', 'boolean', 'object', 'array'],
    default: 'string'
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['feature_limits', 'general', 'ui', 'security'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  modifiedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Static method to get setting value with default
FeatureSettingsSchema.statics.getSetting = async function(key, defaultValue = null) {
  try {
    const setting = await this.findOne({ settingKey: key, isActive: true });
    return setting ? setting.settingValue : defaultValue;
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error);
    return defaultValue;
  }
};

// Static method to set setting value
FeatureSettingsSchema.statics.setSetting = async function(key, value, description, type = 'string', category = 'general', modifiedBy = 'admin') {
  try {
    const setting = await this.findOneAndUpdate(
      { settingKey: key },
      {
        settingValue: value,
        settingType: type,
        description,
        category,
        lastModified: new Date(),
        modifiedBy,
        isActive: true
      },
      { 
        upsert: true, 
        new: true,
        runValidators: true
      }
    );
    return setting;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
    throw error;
  }
};

// Static method to initialize default settings
FeatureSettingsSchema.statics.initializeDefaults = async function() {
  try {
    const defaults = [
      {
        key: 'feature_daily_limit',
        value: 300,
        type: 'number',
        description: 'Daily feature usage limit for all users',
        category: 'feature_limits'
      },
      {
        key: 'feature_enabled_modules',
        value: ['rewrite', 'write-story', 'quick-story'],
        type: 'array',
        description: 'Enabled feature modules that count towards daily limit',
        category: 'feature_limits'
      },
      {
        key: 'feature_tracking_enabled',
        value: true,
        type: 'boolean',
        description: 'Enable/disable feature usage tracking',
        category: 'feature_limits'
      }
    ];

    for (const setting of defaults) {
      const exists = await this.findOne({ settingKey: setting.key });
      if (!exists) {
        await this.setSetting(
          setting.key,
          setting.value,
          setting.description,
          setting.type,
          setting.category,
          'system'
        );
        console.log(`✅ Initialized setting: ${setting.key} = ${setting.value}`);
      }
    }
  } catch (error) {
    console.error('Error initializing default settings:', error);
  }
};

module.exports = mongoose.model('FeatureSettings', FeatureSettingsSchema);