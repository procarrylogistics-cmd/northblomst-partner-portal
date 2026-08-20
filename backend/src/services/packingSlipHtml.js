/**
 * Partner production sheet HTML – single A4 page, compact for dense flower orders.
 * Includes Bloomit-style cut-out delivery label with TrackPod QR (order barcode with leading #).
 */

const QRCode = require('qrcode');
const { PACKING_SLIP_CSS, LOGO_URL } = require('./packingSlipStyles');
const { pickMainLineItem } = require('./shopifyPackingSlipData');
const { buildOrderFinanceRow } = require('../utils/orderFinance');
const { COMPANY } = require('../config/company');
const { isDeliveryAddressAddon } = require('../utils/addressSync');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  } catch {
    return '—';
  }
}

function fmtDateTime() {
  const dt = new Date();
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

/** Danish weekday + date for delivery label, e.g. "søndag 16.08.2026" */
function fmtDeliveryLabelDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    return `${days[dt.getDay()]} ${dd}.${mm}.${yyyy}`;
  } catch {
    return '—';
  }
}

function money(amount, currency = 'DKK') {
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return '';
  try {
    return new Intl.NumberFormat('da-DK', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function imgTag(li, className) {
  const src = li.imageDataUri || li.imageUrl;
  if (!src) return '';
  return `<img class="${className}" src="${esc(src)}" alt="" />`;
}

function truncate(value, max = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function isNoiseKey(name) {
  const n = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!n || n.startsWith('_')) return true;
  return /recipient name|leveringsadresse|delivery address|phone|telefon|delivery date|leveringsdato|sender name|afsender/.test(
    n
  );
}

/**
 * Track-POD barcode value for QR scan (Load Check / delivery).
 * Order numbers include a leading `#` to match Track-POD / Shopify (e.g. `#1228`).
 */
function ensureOrderHash(value) {
  const s = String(value || '').trim();
  if (!s) return s;
  return s.startsWith('#') ? s : `#${s}`;
}

function resolveTrackPodBarcode(mongo, orderName) {
  const tracking = String(mongo.trackingNumber || '').trim();
  if (tracking) return ensureOrderHash(tracking);

  const shopifyNum = String(mongo.shopifyOrderNumber || '').trim();
  if (shopifyNum) return ensureOrderHash(shopifyNum);

  const orderNum = String(mongo.orderNumber || '').trim();
  if (orderNum) return ensureOrderHash(orderNum);

  const name = String(mongo.shopifyOrderName || orderName || '').trim();
  if (name) return ensureOrderHash(name);

  return String(mongo._id || mongo.id || '').trim();
}

function findAddonFlag(mongo, patterns) {
  const list = [...(mongo.addOns || [])];
  for (const a of list) {
    const label = String(a.label || a.key || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!patterns.some((p) => label.includes(p))) continue;
    const v = String(a.value || '').trim().toLowerCase();
    if (!v) continue;
    if (/^(ja|yes|true|1|y)$/i.test(v)) return 'Ja';
    if (/^(nej|no|false|0|n)$/i.test(v)) return 'Nej';
    return String(a.value).trim();
  }
  return null;
}

/** Danish 8-digit phone spacing, e.g. 42833316 → 42 83 33 16 */
function formatCompanyPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
  }
  return String(raw || '').trim();
}

/**
 * Prefer portal-synced delivery fields (edited address / Tilvalg) over Shopify snapshot.
 * Never use billing or partner/terminal address for the cut-out label.
 */
function resolveDeliveryShip(mongo, shopifyOrder) {
  const so = shopifyOrder || {};
  const sa = so.shipping_address || {};
  const ms = mongo.shippingAddress || {};

  const address1 = String(mongo.address || ms.address1 || sa.address1 || '').trim();
  const address2 = String(ms.address2 || sa.address2 || '').trim();
  const zip = String(mongo.postcode || ms.postalCode || sa.zip || sa.postal_code || '').trim();
  const city = String(mongo.city || ms.city || sa.city || '').trim();
  const name = String(
    mongo.recipientName || sa.name || mongo.customer?.name || ''
  ).trim();
  const phone = String(
    mongo.phone || ms.phone || sa.phone || mongo.customer?.phone || ''
  ).trim();
  const company = String(sa.company || ms.company || '').trim();
  const country = String(ms.country || sa.country || '').trim();

  // Fallback: parse Tilvalg "Delivery address" if street fields still empty
  if (!address1 && !zip && !city) {
    const addon = (mongo.addOns || []).find((a) => isDeliveryAddressAddon(a));
    const raw = String(addon?.value || '').trim();
    if (raw) {
      const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const zipCity = parts[parts.length - 1];
        const m = zipCity.match(/^(\d{4})\s+(.+)$/);
        return {
          name,
          address1: parts.slice(0, -1).join(', '),
          address2: '',
          zip: m ? m[1] : '',
          city: m ? m[2] : zipCity,
          country,
          phone,
          company: ''
        };
      }
      return {
        name,
        address1: raw,
        address2: '',
        zip: '',
        city: '',
        country,
        phone,
        company: ''
      };
    }
  }

  return { name, address1, address2, zip, city, country, phone, company };
}

function collectInstructions(ctx) {
  const { lineItems, noteAttributes, mongo, note } = ctx;
  const rows = [];
  const seen = new Set();

  const push = (label, value, maxLen = 140) => {
    const l = String(label || '').trim();
    const v = truncate(value, maxLen);
    if (!l || !v || isNoiseKey(l)) return;
    const key = `${l.toLowerCase()}::${v.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ label: l, value: v });
  };

  for (const a of mongo.addOns || []) {
    push(a.label || a.key, a.value, 160);
  }

  for (const attr of noteAttributes || []) {
    push(attr.name, attr.value, 160);
  }

  for (const li of lineItems || []) {
    for (const p of li.properties || []) {
      push(p.name, p.value, 160);
    }
  }

  const card = String(mongo.cardText || '').trim();
  const orderNote = String(note || mongo.notes || '').trim();
  if (orderNote && orderNote !== card) {
    push('Order note', orderNote, 200);
  }

  return rows.slice(0, 10);
}

function buildContext(payload) {
  const { mongo, shopifyOrder, lineItems, currency } = payload;
  const so = shopifyOrder || {};
  const ship = resolveDeliveryShip(mongo, so);
  const customer = so.customer || mongo.customer || {};
  const orderName = so.name || mongo.shopifyOrderName || `#${mongo.shopifyOrderNumber || ''}`;
  const createdAt = so.created_at || mongo.orderDate || mongo.receivedAt;
  const deliveryDate = mongo.deliveryDate || null;
  const note = so.note || mongo.notes || '';
  const noteAttributes = so.note_attributes || [];
  const mainItem = pickMainLineItem(lineItems);
  const finance = buildOrderFinanceRow(mongo);
  const trackPodBarcode = resolveTrackPodBarcode(mongo, orderName);
  const doorFlag = findAddonFlag(mongo, ['dor', 'door', 'doer']);
  const neighborFlag = findAddonFlag(mongo, ['nabo', 'neighbor', 'neighbour']);

  return {
    lineItems,
    mainItem,
    ship,
    customer,
    orderName,
    createdAt,
    deliveryDate,
    note,
    noteAttributes,
    mongo,
    currency,
    finance,
    trackPodBarcode,
    doorFlag,
    neighborFlag
  };
}

function renderDeliveryLabel(ctx, qrDataUrl) {
  const { ship, orderName, deliveryDate, trackPodBarcode, doorFlag, neighborFlag } = ctx;
  // Always Northblomst on cut-out label — never partner/terminal name, address, or phone
  const phoneDisplay = formatCompanyPhone(COMPANY.phone || '42833316');
  const footerPhone = `Telefon: ${phoneDisplay}`;
  const footerWeb = COMPANY.website || 'northblomst.dk';

  const flags = [];
  if (doorFlag) flags.push(`Dør: ${doorFlag}`);
  if (neighborFlag) flags.push(`Nabo: ${neighborFlag}`);

  return `
  <div class="label-cut"><span>✂ Klip her · Leveringslabel (sæt på plic / blomst)</span></div>
  <div class="delivery-label">
    <div class="dl-left">
      <div class="dl-recipient">
        <div class="dl-name">${esc(ship.name || '—')}</div>
        ${ship.company ? `<div class="dl-line">${esc(ship.company)}</div>` : ''}
        <div class="dl-line">${esc(ship.address1 || '')}</div>
        ${ship.address2 ? `<div class="dl-line">${esc(ship.address2)}</div>` : ''}
        <div class="dl-line">${esc([ship.zip, ship.city].filter(Boolean).join(' '))}</div>
        <div class="dl-date">${esc(fmtDeliveryLabelDate(deliveryDate))}</div>
      </div>
      <div class="dl-footer">
        <div class="dl-partner">${esc(COMPANY.brandName)}</div>
        <div class="dl-line muted">${esc(footerPhone)}</div>
        <div class="dl-line muted">${esc(footerWeb)}</div>
      </div>
    </div>
    <div class="dl-right">
      <div class="dl-order">${esc(orderName)}</div>
      ${flags.length ? `<div class="dl-flags">${flags.map((f) => esc(f)).join('<br/>')}</div>` : ''}
      <div class="dl-qr-wrap">
        <div class="dl-qr-title">Til chauffør:</div>
        ${qrDataUrl ? `<img class="dl-qr" src="${esc(qrDataUrl)}" alt="TrackPod QR ${esc(trackPodBarcode)}" />` : '<div class="dl-qr">QR n/a</div>'}
        <div class="dl-barcode">${esc(trackPodBarcode)}</div>
      </div>
      <img class="dl-logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
    </div>
  </div>`;
}

function renderCompactSheet(ctx, qrDataUrl) {
  const {
    lineItems,
    mainItem,
    ship,
    orderName,
    createdAt,
    deliveryDate,
    mongo,
    currency,
    finance
  } = ctx;

  const instructions = collectInstructions(ctx);
  const cardText = truncate(mongo.cardText || '', 280);
  const sender =
    (mongo.addOns || []).find((a) => /sender|afsender|fra/i.test(String(a.label || '')))?.value ||
    '';

  const productRows = (lineItems || [])
    .slice(0, 6)
    .map((li) => {
      const title = truncate(li.title, 90);
      const variant = li.variant_title ? truncate(li.variant_title, 50) : '';
      return `<tr>
        <td>
          <div class="product-name">${esc(title)}</div>
          ${variant ? `<div class="small">Variant: ${esc(variant)}</div>` : ''}
        </td>
        <td class="qty">${esc(li.quantity)}</td>
      </tr>`;
    })
    .join('');

  const extraCount = Math.max(0, (lineItems || []).length - 6);
  const mainImg =
    mainItem && (mainItem.imageDataUri || mainItem.imageUrl)
      ? imgTag(mainItem, 'main-img')
      : '<div class="main-img no-img">No image</div>';

  const payout = finance?.partnerPayout;
  const flowerValue = finance?.flowerValue;
  const delivery = finance?.shipping;
  const platform = finance?.platformCommission;
  const payoutEx = finance?.partnerPayoutExMoms;
  const payoutMoms = finance?.partnerPayoutMoms;
  const momsPercent = finance?.momsPercent ?? 25;

  const instructionRows = instructions
    .map(
      (r) =>
        `<div class="info-row"><span class="info-label">${esc(r.label)}</span><span class="info-value">${esc(r.value)}</span></div>`
    )
    .join('');

  return `<div class="page">
  <div class="header">
    <div class="logo-wrap">
      <img class="logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
    </div>
    <div class="doc-title">
      <h1>Partner Production</h1>
      <p>${esc(orderName)} · printed ${esc(fmtDateTime())}</p>
    </div>
    <div class="status-box">
      <div class="status-pill">1 page</div>
      <div><strong>Items:</strong> ${(lineItems || []).length}</div>
    </div>
  </div>

  <div class="order-row">
    <div class="mini"><div class="label">Order</div><div class="value">${esc(orderName)}</div></div>
    <div class="mini"><div class="label">Ordered</div><div class="value">${esc(fmtDate(createdAt))}</div></div>
    <div class="mini"><div class="label">Delivery date</div><div class="value">${esc(fmtDate(deliveryDate))}</div></div>
    <div class="mini"><div class="label">Your payout</div><div class="value">${esc(money(payout, currency))}</div></div>
  </div>

  <div class="produce-box">
    <div class="produce-title">What to produce</div>
    <div class="produce-flex">
      ${mainImg}
      <div>
        ${
          mainItem
            ? `<div class="main-product-title">${esc(truncate(mainItem.title, 110))}</div>
        ${mainItem.variant_title ? `<div class="small">Variant: ${esc(truncate(mainItem.variant_title, 70))}</div>` : ''}
        <div class="tag">Qty ${esc(mainItem.quantity)}</div>
        <div class="tag">Make this bouquet</div>`
            : '<div class="muted">No main product</div>'
        }
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="box">
      <div class="box-title">Recipient / Delivery</div>
      <div class="name">${esc(ship.name)}</div>
      ${ship.company ? `<div class="line">${esc(ship.company)}</div>` : ''}
      <div class="line">${esc(ship.address1)}</div>
      ${ship.address2 ? `<div class="line">${esc(ship.address2)}</div>` : ''}
      <div class="line">${esc(ship.zip)} ${esc(ship.city)}</div>
      ${ship.phone ? `<div class="line strong" style="margin-top:3px;">Phone: ${esc(ship.phone)}</div>` : ''}
    </div>
    <div class="box">
      <div class="box-title">Payout / Price</div>
      <table class="summary">
        <tr><td class="s-label">Flower price</td><td class="s-value">${esc(money(flowerValue, currency))}</td></tr>
        <tr><td class="s-label">Platform fee (20%)</td><td class="s-value">− ${esc(money(platform, currency))}</td></tr>
        <tr><td class="s-label">Excl. MOMS</td><td class="s-value">${esc(money(payoutEx, currency))}</td></tr>
        <tr><td class="s-label">MOMS (${esc(momsPercent)}%)</td><td class="s-value">${esc(money(payoutMoms, currency))}</td></tr>
        <tr><td class="s-label">${finance?.handlesDelivery === false ? 'Delivery (not included)' : 'Delivery'}</td><td class="s-value">${esc(money(delivery, currency))}</td></tr>
        <tr class="total"><td class="s-label">Your payout (inkl. MOMS)</td><td class="s-value">${esc(money(payout, currency))}</td></tr>
      </table>
    </div>
  </div>

  <div class="box">
    <div class="box-title">Products / Add-ons ${extraCount ? `(showing 6 of ${(lineItems || []).length})` : ''}</div>
    <table>
      <thead><tr><th>Product</th><th class="qty">Qty</th></tr></thead>
      <tbody>${productRows || '<tr><td colspan="2">No products</td></tr>'}</tbody>
    </table>
  </div>

  ${
    instructionRows
      ? `<div class="box">
    <div class="box-title">Florist notes / Tilvalg</div>
    ${instructionRows}
  </div>`
      : ''
  }

  ${
    cardText
      ? `<div class="box">
    <div class="box-title">Korttekst ${sender ? `· ${esc(truncate(sender, 50))}` : ''}</div>
    <div class="card-message">${esc(cardText)}</div>
  </div>`
      : ''
  }

  <div class="signature-area">
    <div class="check"><span class="square"></span>Product checked</div>
    <div class="check"><span class="square"></span>Card / message</div>
    <div class="check"><span class="square"></span>Add-ons packed</div>
    <div class="check"><span class="square"></span>Photo taken</div>
  </div>

  ${renderDeliveryLabel(ctx, qrDataUrl)}

  <div class="footer">
    <div>Northblomst · 1-page production · klip leveringslabel · TrackPod QR = ordre-nr</div>
    <div>${esc(orderName)}</div>
  </div>
</div>`;
}

async function renderPackingSlipHtml(payload) {
  const ctx = buildContext(payload);
  const orderName = ctx.orderName;
  const barcode = ctx.trackPodBarcode || ensureOrderHash(orderName);

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(String(barcode), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('TrackPod QR generation failed', err.message);
  }

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <title>Production ${esc(orderName)}</title>
  <style>${PACKING_SLIP_CSS}</style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()">Print</button>
    <span class="no-print-hint">1× A4 · klip leveringslabel med TrackPod QR (ordre ${esc(barcode)})</span>
  </div>
  ${renderCompactSheet(ctx, qrDataUrl)}
  <script>
    window.addEventListener('load', function () {
      var imgs = document.querySelectorAll('img');
      var pending = 0;
      imgs.forEach(function (img) {
        if (!img.complete) {
          pending++;
          img.addEventListener('load', done);
          img.addEventListener('error', done);
        }
      });
      function done() {
        pending--;
        if (pending <= 0) setTimeout(function () { window.print(); }, 250);
      }
      if (pending === 0) setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`;
}

module.exports = { renderPackingSlipHtml, resolveTrackPodBarcode };
