const mongoose = require('mongoose');

const ShopifyOrderSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, index: true },
    topic: { type: String, required: true },
    webhookId: { type: String },
    orderId: { type: String, index: true },
    orderNumber: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ShopifyOrder', ShopifyOrderSchema);
