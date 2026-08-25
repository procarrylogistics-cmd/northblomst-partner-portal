const axios = require('axios');
const {
  resolveDeliveryAddress,
  applyDeliveryAddressToOrder
} = require('../utils/deliveryAddressResolver');

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

/** Leveringsadresse — Tilvalg / portal fields, not foreign Shopify shipping. */
function resolveDeliveryFields(order) {
  const resolved = resolveDeliveryAddress(order);
  return {
    address1: resolved.address1,
    address2: resolved.address2,
    postalCode: resolved.postalCode,
    city: resolved.city,
    country: resolved.country || 'DK',
    phone: resolved.phone,
    recipientName: resolved.recipientName
  };
}

function buildPayload(order) {
  const {
    address1,
    address2,
    postalCode,
    city,
    country,
    phone,
    recipientName
  } = resolveDeliveryFields(order);

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
    addressLine1: address1,
    addressLine2: address2 || null,
    postalCode,
    city,
    country,
    deliveryDate,
    deliveryNote: noteParts.length ? noteParts.join('\n') : null
  };
}

function formatTrackError(err) {
  const status = err?.response?.status;
  const body = err?.response?.data;
  const detail =
    (typeof body === 'string' && body) ||
    body?.error ||
    body?.message ||
    err?.message ||
    'Unknown error';
  return status ? `${detail} (HTTP ${status})` : detail;
}

async function pushOrderToProcarryTrack(order) {
  const base = getTrackApiBase();
  const apiKey = (process.env.PROCARRY_TRACK_API_KEY || '').trim();

  if (!base || !apiKey) {
    console.warn(
      'PROCARRY_TRACK_API_URL / PROCARRY_TRACK_API_KEY not set, skipping Track push'
    );
    return {
      ok: false,
      skipped: true,
      reason: 'not_configured',
      error:
        'PROCARRY_TRACK_API_URL eller PROCARRY_TRACK_API_KEY mangler på backend (Render)'
    };
  }

  if (order.procarryTrackOrderId) {
    return {
      ok: true,
      skipped: true,
      reason: 'already_pushed',
      id: order.procarryTrackOrderId,
      trackingUrl: order.trackingUrl || null
    };
  }

  applyDeliveryAddressToOrder(order);
  await order.save();

  const payload = buildPayload(order);
  const missing = [];
  if (!payload.addressLine1) missing.push('adresse');
  if (!payload.postalCode) missing.push('postnr');
  if (!payload.city) missing.push('by');
  if (missing.length) {
    console.warn(
      '[procarry-track] skip push: missing address fields',
      payload.portalOrderId,
      missing
    );
    return {
      ok: false,
      skipped: true,
      reason: 'missing_address',
      error: `Mangler leveringsadresse: ${missing.join(', ')}`,
      missing
    };
  }

  const url = `${base}/api/integrations/northblomst/orders`;
  try {
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

    return {
      ok: true,
      skipped: false,
      created: !!data?.created,
      id: data?.id || null,
      trackingUrl: data?.trackingUrl || null,
      trackingToken: data?.trackingToken || null
    };
  } catch (err) {
    const error = formatTrackError(err);
    console.error('procarry-track push failed', error, err?.response?.data);
    return { ok: false, skipped: false, error, status: err?.response?.status };
  }
}

module.exports = {
  pushOrderToProcarryTrack,
  buildPayload,
  resolveDeliveryFields,
  getTrackApiBase
};
