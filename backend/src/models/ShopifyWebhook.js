const mongoose = require('mongoose');

const ShopifyWebhookSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    shop: { type: String },
    receivedAt: { type: Date, default: Date.now },
    payload: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { collection: 'shopifywebhooks', timestamps: true }
);

module.exports = mongoose.model('ShopifyWebhook', ShopifyWebhookSchema);
