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
const { resolveDeliveryAddress } = require('../utils/deliveryAddressResolver');
const { isCardMessageAddon } = require('../utils/cardTextSync');

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
  // Track-POD Load Check expects Shopify order number with # (e.g. #1228).
  // Do not use trackingNumber — that may hold a procarry-track token, not the order id.
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
  const r = resolveDeliveryAddress(mongo, shopifyOrder || {});
  const sa = (shopifyOrder || {}).shipping_address || {};
  return {
    name: r.recipientName,
    address1: r.address1,
    address2: r.address2,
    zip: r.postalCode,
    city: r.city,
    country: r.country,
    phone: r.phone,
    company: String(sa.company || mongo.shippingAddress?.company || '').trim()
  };
}

function resolveCardMessage(mongo, lineItems, noteAttributes) {
  const direct = String(mongo?.cardText || '').trim();
  if (direct) return direct;

  for (const a of mongo?.addOns || []) {
    if (isCardMessageAddon(a) && String(a.value || '').trim()) {
      return String(a.value).trim();
    }
  }

  for (const attr of noteAttributes || []) {
    const name = String(attr.name || '').toLowerCase();
    if (/card\s*message|korttekst|kort\s*besked|dedication/.test(name) && String(attr.value || '').trim()) {
      return String(attr.value).trim();
    }
  }

  for (const li of lineItems || []) {
    for (const p of li.properties || []) {
      const name = String(p.name || '').toLowerCase();
      if (/card\s*message|korttekst|kort\s*besked|dedication/.test(name) && String(p.value || '').trim()) {
        return String(p.value).trim();
      }
    }
  }

  return String(mongo?.customer?.message || '').trim();
}

function resolveSenderName(mongo) {
  for (const a of mongo?.addOns || []) {
    if (!a?.value?.trim()) continue;
    const label = String(a.label || a.key || '').toLowerCase();
    if (/sender|afsender|^fra$|sendt af/.test(label)) return String(a.value).trim();
  }
  return '';
}

function collectInstructions(ctx) {
  const { lineItems, noteAttributes, mongo, note } = ctx;
  const rows = [];
  const seen = new Set();

  const push = (label, value, maxLen = 140) => {
    const l = String(label || '').trim();
    const v = truncate(value, maxLen);
    if (!l || !v || isNoiseKey(l)) return;
    if (isCardMessageAddon({ label: l, key: '', value: v })) return;
    const key = `${l.toLowerCase()}::${v.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ label: l, value: v });
  };

  for (const a of mongo.addOns || []) {
    if (isCardMessageAddon(a)) continue;
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

  const card = resolveCardMessage(mongo, lineItems, noteAttributes);
  const orderNote = String(note || mongo.notes || '').trim();
  if (orderNote && orderNote !== card) {
    push('Order note', orderNote, 200);
  }

  return rows.slice(0, 6);
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

function renderCutOutCards(ctx, qrDataUrl) {
  const { ship, orderName, deliveryDate, trackPodBarcode, doorFlag, neighborFlag, mongo, lineItems, noteAttributes } =
    ctx;
  const phoneDisplay = formatCompanyPhone(COMPANY.phone || '42833316');
  const footerPhone = phoneDisplay;
  const footerWeb = COMPANY.website || 'northblomst.dk';

  const flags = [];
  if (doorFlag) flags.push(`Dør: ${doorFlag}`);
  if (neighborFlag) flags.push(`Nabo: ${neighborFlag}`);

  const messageRaw = resolveCardMessage(mongo, lineItems, noteAttributes);
  const message = truncate(messageRaw, 300);
  const sender = resolveSenderName(mongo);

  const card1 = `
  <div class="cut-card card-delivery">
    <span class="cut-card-tag">1 · Levering</span>
    <div class="cd-left">
      <div class="cd-body">
        <div class="cd-name">${esc(ship.name || '—')}</div>
        ${ship.company ? `<div class="cd-line">${esc(ship.company)}</div>` : ''}
        <div class="cd-line">${esc(ship.address1 || '')}</div>
        ${ship.address2 ? `<div class="cd-line">${esc(ship.address2)}</div>` : ''}
        <div class="cd-line">${esc([ship.zip, ship.city].filter(Boolean).join(' '))}</div>
        <div class="cd-date">${esc(fmtDeliveryLabelDate(deliveryDate))}</div>
        ${flags.length ? `<div class="cd-line" style="margin-top:2px;font-weight:700;">${flags.map((f) => esc(f)).join(' · ')}</div>` : ''}
      </div>
      <div class="cd-foot">
        <div class="cd-brand">${esc(COMPANY.brandName)}</div>
        <div class="cd-muted">Telefon: ${esc(footerPhone)}</div>
        <div class="cd-muted">${esc(footerWeb)}</div>
      </div>
    </div>
    <div class="cd-right">
      <div class="cd-order">${esc(orderName)}</div>
      <div class="cd-qr-title">Til chauffør:</div>
      ${qrDataUrl ? `<img class="cd-qr" src="${esc(qrDataUrl)}" alt="TrackPod QR ${esc(trackPodBarcode)}" />` : '<div class="cd-qr">QR n/a</div>'}
      <div class="cd-barcode">${esc(trackPodBarcode)}</div>
      <img class="cd-logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
    </div>
  </div>`;

  const card2 = `
  <div class="cut-card card-brand">
    <span class="cut-card-tag">2 · Visitkort</span>
    <div class="cb-inner">
      <img class="cb-logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
      <p class="cb-script">Northblomst</p>
      <div class="cb-sub">Flowers with a smile</div>
      <div class="cb-pitch">Send flowers back — or surprise someone next</div>
      <div class="cb-promo">
        <div class="cb-promo-label">10% off your next order</div>
        <div class="cb-promo-code">WELCOME10</div>
        <div class="cb-promo-hint">Use at checkout · ${esc(footerWeb)}</div>
      </div>
      <div class="cb-contact">${esc(footerPhone)}</div>
    </div>
  </div>`;

  const card3 = `
  <div class="cut-card card-care">
    <span class="cut-card-tag">3 · Pleje</span>
    <h3 class="cc-title">Sådan holder blomsterne længst</h3>
    <ol class="cc-list">
      <li>Skær stilkene skråt (ca. 2 cm) inden de sættes i vand.</li>
      <li>Brug en ren vase og frisk, lunkent vand.</li>
      <li>Fjern blade under vandlinjen — de rådner i vandet.</li>
      <li>Skift vand hver 2.–3. dag og beskær stilkene igen.</li>
      <li>Hold blomsterne køligt, væk fra direkte sol, varme og frugt.</li>
      <li>Tilsæt blomsternæring, hvis det følger med.</li>
    </ol>
    <div class="cc-foot">Northblomst · ${esc(footerWeb)}</div>
  </div>`;

  const card4 = `
  <div class="cut-card card-message-cut">
    <span class="cut-card-tag">4 · Besked</span>
    <div class="cm-title">En hilsen til dig</div>
    <div class="cm-body${message ? '' : ' is-empty'}">${message ? esc(message) : 'Ingen korttekst på denne ordre'}</div>
    ${sender ? `<div class="cm-from">— ${esc(truncate(sender, 60))}</div>` : ''}
    <div class="cm-brand">Northblomst</div>
  </div>`;

  return `
  <div class="cards-cut"><span>✂ Klip her · 4 kort (levering · visitkort · pleje · besked)</span></div>
  <div class="cards-grid">
    ${card1}
    ${card2}
    ${card3}
    ${card4}
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
  const sender =
    (mongo.addOns || []).find((a) => /sender|afsender|fra/i.test(String(a.label || '')))?.value ||
    '';

  const productRows = (lineItems || [])
    .slice(0, 4)
    .map((li) => {
      const title = truncate(li.title, 80);
      const variant = li.variant_title ? truncate(li.variant_title, 40) : '';
      return `<tr>
        <td>
          <div class="product-name">${esc(title)}</div>
          ${variant ? `<div class="small">Variant: ${esc(variant)}</div>` : ''}
        </td>
        <td class="qty">${esc(li.quantity)}</td>
      </tr>`;
    })
    .join('');

  const extraCount = Math.max(0, (lineItems || []).length - 4);
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
    <div class="box-title">Products / Add-ons ${extraCount ? `(showing 4 of ${(lineItems || []).length})` : ''}</div>
    <table>
      <thead><tr><th>Product</th><th class="qty">Qty</th></tr></thead>
      <tbody>${productRows || '<tr><td colspan="2">No products</td></tr>'}</tbody>
    </table>
  </div>

  ${
    instructionRows
      ? `<div class="box">
    <div class="box-title">Florist notes / Tilvalg${sender ? ` · ${esc(truncate(sender, 40))}` : ''}</div>
    ${instructionRows}
  </div>`
      : ''
  }

  <div class="signature-area">
    <div class="check"><span class="square"></span>Product checked</div>
    <div class="check"><span class="square"></span>Card / message</div>
    <div class="check"><span class="square"></span>Add-ons packed</div>
    <div class="check"><span class="square"></span>Photo taken</div>
  </div>

  ${renderCutOutCards(ctx, qrDataUrl)}

  <div class="footer">
    <div>Northblomst · 1-page · 4 klip-kort · TrackPod QR = ordre-nr</div>
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
      width: 120,
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
    <span class="no-print-hint">1× A4 · 4 klip-kort (levering QR · brand · pleje · besked) · ordre ${esc(barcode)}</span>
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
