const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  paymentIntentId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'inr' },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'requires_payment_method'],
    default: 'pending',
  },
  clientSecret: { type: String },
  idempotencyKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

paymentSchema.index({ orderId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
