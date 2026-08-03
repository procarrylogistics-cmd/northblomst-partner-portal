const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['order_assigned'],
      default: 'order_assigned'
    },
    title: { type: String, default: 'Ny ordre modtaget' },
    body: { type: String, default: '' },
    source: {
      type: String,
      enum: ['admin', 'auto', 'system'],
      default: 'system'
    },
    readAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

NotificationSchema.index({ partner: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ partner: 1, order: 1, readAt: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
