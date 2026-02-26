const nodemailer = require('nodemailer');

const PORTAL_URL = process.env.PORTAL_URL || 'https://portal.northblomst.dk';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Northblomst <no-reply@northblomst.dk>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass }
  });
  return transporter;
}

async function sendMail(options) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('Email not configured (EMAIL_USER/EMAIL_PASS missing). Skip send.');
    return;
  }
  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      ...options
    });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

/**
 * Send to partner when an order is assigned to them.
 * Called after PATCH /api/orders/:id/assign (async, non-blocking).
 */
async function sendOrderAssignedToPartner(partner, order) {
  if (!partner?.email) return;
  const orderNumber = order.shopifyOrderName || order.shopifyOrderNumber || order._id;
  const customerName = order.customer?.name || '–';
  const city = order.shippingAddress?.city || '';
  const postal = order.shippingAddress?.postalCode || '';
  const location = [postal, city].filter(Boolean).join(' ') || '–';
  const orderDirectLink = `${PORTAL_URL}/partner?order=${order._id}`;
  const loginLink = `${PORTAL_URL}/login`;

  const html = `
    <p>Hej ${escapeHtml(partner.name || 'partner')},</p>
    <p>Du har en ny ordre i portalen: <strong>${escapeHtml(String(orderNumber))}</strong></p>
    <p>Kunde: ${escapeHtml(customerName)}, ${escapeHtml(location)}</p>
    <p>Direkte link til ordren: <a href="${orderDirectLink}">${orderDirectLink}</a></p>
    <p>Log ind her: <a href="${loginLink}">${loginLink}</a></p>
    <p>Venlig hilsen,<br>Northblomst</p>
  `;

  await sendMail({
    to: partner.email,
    subject: `Ny ordre tildelt dig - Northblomst [${orderNumber}]`,
    html
  });
}

/**
 * Send to admin when partner updates order status (e.g. in_production, ready, fulfilled).
 * Called after PATCH /api/orders/:id/status (async, non-blocking).
 */
async function sendStatusChangeToAdmin(order, newStatus) {
  if (!ADMIN_EMAIL) {
    console.warn('ADMIN_EMAIL not set. Skip status notification.');
    return;
  }
  const orderNumber = order.shopifyOrderName || order.shopifyOrderNumber || order._id;
  const partnerName = order.partner?.name || order.partner?.email || '–';
  const statusLabel = { new: 'Ny', in_production: 'I produktion', ready: 'Klar til levering', fulfilled: 'Leveret' }[newStatus] || newStatus;

  const html = `
    <p>Ordrestatus er opdateret i partnerportalen.</p>
    <p><strong>Ordre:</strong> ${escapeHtml(String(orderNumber))}</p>
    <p><strong>Ny status:</strong> ${escapeHtml(statusLabel)}</p>
    <p><strong>Partner:</strong> ${escapeHtml(partnerName)}</p>
    <p><a href="${PORTAL_URL}/admin">Åbn admin-portalen</a></p>
    <p>Venlig hilsen,<br>Northblomst</p>
  `;

  await sendMail({
    to: ADMIN_EMAIL,
    subject: `Ordre ${orderNumber} - ${statusLabel} (Northblomst)`,
    html
  });
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  sendOrderAssignedToPartner,
  sendStatusChangeToAdmin
};
