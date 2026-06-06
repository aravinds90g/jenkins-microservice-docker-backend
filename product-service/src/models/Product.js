const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  options: [{ type: String, required: true }],
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, min: 0 },
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  reviewsCount: { type: Number, default: 0 },
  image: { type: String, required: true },
  category: { type: String, required: true, lowercase: true },
  isNew: { type: Boolean, default: false },
  isHot: { type: Boolean, default: false },
  isSale: { type: Boolean, default: false },
  discount: { type: String },
  stock: { type: Number, required: true, min: 0, default: 10 },
  specs: { type: Map, of: String, default: {} },
  variants: [variantSchema],
}, { timestamps: true, suppressReservedKeysWarning: true });

productSchema.index({ name: 'text', brand: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
