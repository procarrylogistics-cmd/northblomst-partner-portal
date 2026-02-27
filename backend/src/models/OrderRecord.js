/**
 * Orders from Shopify webhook – saved after fetch from Admin API.
 * Collection: order_records (separate from legacy Order for partner portal).
 */

const mongoose = require('mongoose');

const OrderRecordSchema = new mongoose.Schema(
  {
    shop: { type: String, required: true, index: true },
    orderId: { type: Number, required: true, index: true },
    orderGid: { type: String },
    name: { type: String, required: true }, // e.g. #1010
    createdAt: { type: Date, required: true },
    raw: {
      payload: { type: mongoose.Schema.Types.Mixed },
      orderDetails: { type: mongoose.Schema.Types.Mixed }
    },
    status: { type: String, enum: ['NEW', 'ASSIGNED'], default: 'NEW', index: true },
    assignedPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    printableData: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

OrderRecordSchema.index({ shop: 1, orderId: 1 }, { unique: true });

module.exports = mongoose.model('OrderRecord', OrderRecordSchema, 'order_records');
