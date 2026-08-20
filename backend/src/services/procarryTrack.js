const axios = require('axios');

/**
 * Push a portal order to procarry-track when it becomes ready for delivery.
 * Idempotent: skips if procarryTrackOrderId already set; Track also keys on portalOrderId.
 *
 * Env:
 *   PROCARRY_TRACK_API_URL  e.g. https://procarry-track.vercel.app
 *   PROCARRY_TRACK_API_KEY  shared secret (Bearer / X-Api-Key)
 */
function getTrackApiBase() {
  return (process.env.PROCARRY_TRACK_API_URL || '').replace(/\/$/, '');
}

function resolveOrderNumber(order) {
  const raw =
    order.shopifyOrderName ||
    order.shopifyOrderNumber ||
    order.orderNumber ||
    '';
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed.replace(/^#+/, '')}`;
}

function buildPayload(order) {
  const address =
    order.address ||
    order.shippingAddress?.address1 ||
    '';
  const postcode =
    order.postcode ||
    order.shippingAddress?.postalCode ||
    '';
  const city = order.city || order.shippingAddress?.city || '';
  const phone =
    order.phone ||
    order.customer?.phone ||
    '';
  const recipientName =
    order.recipientName ||
    order.customer?.name ||
    'Recipient';

  const deliveryDate = order.deliveryDate
    ? new Date(order.deliveryDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const noteParts = [];
  if (order.productSummary) noteParts.push(order.productSummary);
  if (order.notes) noteParts.push(order.notes);
  if (order.cardText) noteParts.push(`Card: ${order.cardText}`);

  return {
    portalOrderId: order._id.toString(),
    orderNumber: resolveOrderNumber(order),
    recipientName,
    recipientPhone: phone || null,
    customerEmail: order.customer?.email || null,
    addressLine1: address,
    postalCode: postcode,
    city,
    country: order.shippingAddress?.country || 'DK',
    deliveryDate,
    deliveryNote: noteParts.length ? noteParts.join('\n') : null
  };
}

async function pushOrderToProcarryTrack(order) {
  const base = getTrackApiBase();
  const apiKey = (process.env.PROCARRY_TRACK_API_KEY || '').trim();

  if (!base || !apiKey) {
    console.warn(
      'PROCARRY_TRACK_API_URL / PROCARRY_TRACK_API_KEY not set, skipping Track push'
    );
    return null;
  }

  if (order.procarryTrackOrderId) {
    return { id: order.procarryTrackOrderId, created: false, skipped: true };
  }

  const payload = buildPayload(order);
  if (!payload.addressLine1 || !payload.postalCode || !payload.city) {
    console.warn(
      '[procarry-track] skip push: missing address fields',
      payload.portalOrderId
    );
    return null;
  }

  const url = `${base}/api/integrations/northblomst/orders`;
  const { data } = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Api-Key': apiKey
    },
    timeout: 20000
  });

  if (data?.id) {
    order.procarryTrackOrderId = data.id;
    if (data.trackingUrl && !order.trackingUrl) {
      order.trackingUrl = data.trackingUrl;
    }
    if (data.trackingToken && !order.trackingNumber) {
      order.trackingNumber = data.trackingToken;
    }
    await order.save();
  }

  return data;
}

module.exports = {
  pushOrderToProcarryTrack,
  buildPayload
};
