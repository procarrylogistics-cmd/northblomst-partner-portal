const Notification = require('../models/Notification');

function orderLabel(order) {
  return (
    order?.shopifyOrderName ||
    (order?.shopifyOrderNumber ? `#${order.shopifyOrderNumber}` : null) ||
    order?.orderNumber ||
    String(order?._id || '')
  );
}

function buildBody(order, source) {
  const label = orderLabel(order);
  const recipient = order?.recipientName || order?.customer?.name || '';
  const city = order?.city || order?.shippingAddress?.city || '';
  const postcode = order?.postcode || order?.shippingAddress?.postalCode || '';
  const place = [postcode, city].filter(Boolean).join(' ');
  const via =
    source === 'admin' ? 'tildelt manuelt' : source === 'auto' ? 'tildelt automatisk' : 'tildelt';
  const parts = [`Ordre ${label}`, via];
  if (recipient) parts.push(recipient);
  if (place) parts.push(place);
  return parts.join(' · ');
}

/**
 * Create (or refresh) an unread assignment notification for a partner.
 * Dedupes: if an unread notification already exists for the same order, bump it.
 */
async function notifyPartnerOrderAssigned({ partnerId, order, source = 'system' }) {
  if (!partnerId || !order?._id) return null;

  try {
    const existing = await Notification.findOne({
      partner: partnerId,
      order: order._id,
      type: 'order_assigned',
      readAt: null
    });

    if (existing) {
      existing.title = 'Ny ordre modtaget';
      existing.body = buildBody(order, source);
      existing.source = source;
      existing.createdAt = new Date();
      await existing.save();
      return existing;
    }

    return await Notification.create({
      partner: partnerId,
      order: order._id,
      type: 'order_assigned',
      title: 'Ny ordre modtaget',
      body: buildBody(order, source),
      source
    });
  } catch (err) {
    console.error('notifyPartnerOrderAssigned failed', err);
    return null;
  }
}

module.exports = {
  notifyPartnerOrderAssigned,
  orderLabel,
  buildBody
};
