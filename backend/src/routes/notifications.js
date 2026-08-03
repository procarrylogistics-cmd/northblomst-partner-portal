const express = require('express');
const Notification = require('../models/Notification');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function serialize(n) {
  return {
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    source: n.source,
    orderId: n.order ? String(n.order._id || n.order) : null,
    orderNumber:
      n.order?.shopifyOrderName ||
      n.order?.orderNumber ||
      (n.order?.shopifyOrderNumber ? `#${n.order.shopifyOrderNumber}` : null),
    readAt: n.readAt,
    createdAt: n.createdAt
  };
}

/** Unread count — light poll endpoint */
router.get('/unread-count', requireRole('partner'), async (req, res) => {
  const count = await Notification.countDocuments({
    partner: req.user.id,
    readAt: null
  });
  res.json({ count });
});

/** Recent notifications (newest first) */
router.get('/', requireRole('partner'), async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const items = await Notification.find({ partner: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('order', 'orderNumber shopifyOrderName shopifyOrderNumber recipientName status');
  const unreadCount = await Notification.countDocuments({
    partner: req.user.id,
    readAt: null
  });
  res.json({ items: items.map(serialize), unreadCount });
});

/** Mark one as read */
router.patch('/:id/read', requireRole('partner'), async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, partner: req.user.id });
  if (!n) return res.status(404).json({ message: 'Notification not found' });
  if (!n.readAt) {
    n.readAt = new Date();
    await n.save();
  }
  res.json(serialize(n));
});

/** Mark all as read */
router.post('/read-all', requireRole('partner'), async (req, res) => {
  const result = await Notification.updateMany(
    { partner: req.user.id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ marked: result.modifiedCount || 0 });
});

module.exports = router;
