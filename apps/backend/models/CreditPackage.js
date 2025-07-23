const mongoose = require('mongoose');

const creditPackageSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true }, // e.g., 'monthly_400k', 'lifetime_2m', 'daily_trial'
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  durationType: { type: String, enum: ['days', 'months'], default: 'months' }, // NEW: duration type
  durationValue: { type: Number, required: true }, // NEW: duration value (days or months)
  durationMonths: { type: Number }, // DEPRECATED: for backward compatibility
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('CreditPackage', creditPackageSchema); 