const mongoose = require('mongoose');

const creditPackageSchema = new mongoose.Schema({
  planId: { type: String, required: true, unique: true }, // e.g., 'monthly_400k', 'lifetime_2m'
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  durationMonths: { type: Number, required: true }, // 1 for monthly, 3 for quarterly, 999 for lifetime
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('CreditPackage', creditPackageSchema); 