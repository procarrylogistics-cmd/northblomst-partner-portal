const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

// Zapier / TrackPOD callback to attach tracking URL or number
router.post('/trackpod', async (req, res) => {
  const { orderId, trackingUrl, trackingNumber } = req.body || {};
  if (!orderId) {
    return res.status(400).json({ message: 'orderId required' });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (trackingUrl) order.trackingUrl = trackingUrl;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  await order.save();

  res.json({ success: true });
});

module.exports = router;

