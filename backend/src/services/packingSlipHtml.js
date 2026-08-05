/**
 * Partner production sheet HTML – single A4 page, compact for dense flower orders.
 */

const { PACKING_SLIP_CSS, LOGO_URL } = require('./packingSlipStyles');
const { pickMainLineItem } = require('./shopifyPackingSlipData');
const { buildOrderFinanceRow } = require('../utils/orderFinance');

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

function truncate(value, max = 120) {
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
  // Skip fields already shown elsewhere on the sheet
  return /recipient name|leveringsadresse|delivery address|phone|telefon|delivery date|leveringsdato|sender name|afsender/.test(
    n
  );
}

/** Collect unique tilvalg / properties for the florist, capped for one page. */
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
    push(a.label || a.key, a.value);
  }

  for (const attr of noteAttributes || []) {
    push(attr.name, attr.value);
  }

  for (const li of lineItems || []) {
    for (const p of li.properties || []) {
      push(p.name, p.value);
    }
  }

  const card = String(mongo.cardText || '').trim();
  const orderNote = String(note || mongo.notes || '').trim();
  if (orderNote && orderNote !== card) {
    push('Order note', orderNote, 180);
  }

  // Hard cap so dense Shopify props never blow past one page
  return rows.slice(0, 12);
}

function buildContext(payload) {
  const { mongo, shopifyOrder, lineItems, currency } = payload;
  const so = shopifyOrder || {};
  const ship = so.shipping_address || {
    name: mongo.recipientName || mongo.customer?.name,
    address1: mongo.address || mongo.shippingAddress?.address1,
    address2: mongo.shippingAddress?.address2,
    zip: mongo.postcode || mongo.shippingAddress?.postalCode,
    city: mongo.city || mongo.shippingAddress?.city,
    country: mongo.shippingAddress?.country,
    phone: mongo.phone || mongo.customer?.phone,
    company: ''
  };
  const customer = so.customer || mongo.customer || {};
  const orderName = so.name || mongo.shopifyOrderName || `#${mongo.shopifyOrderNumber || ''}`;
  const createdAt = so.created_at || mongo.orderDate || mongo.receivedAt;
  const deliveryDate = mongo.deliveryDate || null;
  const note = so.note || mongo.notes || '';
  const noteAttributes = so.note_attributes || [];
  const mainItem = pickMainLineItem(lineItems);
  const finance = buildOrderFinanceRow(mongo);

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
    finance
  };
}

function renderCompactSheet(ctx) {
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
  const cardText = truncate(mongo.cardText || '', 220);
  const sender =
    (mongo.addOns || []).find((a) => /sender|afsender|fra/i.test(String(a.label || '')))?.value ||
    '';

  const productRows = (lineItems || [])
    .slice(0, 8)
    .map((li) => {
      const title = truncate(li.title, 70);
      const variant = li.variant_title ? truncate(li.variant_title, 40) : '';
      return `<tr>
        <td>
          <span class="product-name">${esc(title)}</span>
          ${variant ? `<span class="small"> · ${esc(variant)}</span>` : ''}
        </td>
        <td class="qty">${esc(li.quantity)}</td>
      </tr>`;
    })
    .join('');

  const extraCount = Math.max(0, (lineItems || []).length - 8);
  const mainThumb =
    mainItem && (mainItem.imageDataUri || mainItem.imageUrl)
      ? imgTag(mainItem, 'main-thumb')
      : '<div class="main-thumb no-img">—</div>';

  const payout = finance?.partnerPayout;
  const flowerValue = finance?.flowerValue;
  const delivery = finance?.shipping;
  const platform = finance?.platformCommission;

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
      <h1>Production</h1>
      <p>${esc(orderName)} · ${esc(fmtDateTime())}</p>
    </div>
    <div class="status-box">
      <div class="status-pill">1 page</div>
    </div>
  </div>

  <div class="order-row">
    <div class="mini"><div class="label">Order</div><div class="value">${esc(orderName)}</div></div>
    <div class="mini"><div class="label">Ordered</div><div class="value">${esc(fmtDate(createdAt))}</div></div>
    <div class="mini"><div class="label">Delivery</div><div class="value">${esc(fmtDate(deliveryDate))}</div></div>
    <div class="mini"><div class="label">Payout</div><div class="value">${esc(money(payout, currency))}</div></div>
  </div>

  <div class="grid-main">
    <div class="box recipient">
      <div class="box-title">Recipient</div>
      <div class="name">${esc(ship.name)}</div>
      ${ship.company ? `<div class="line">${esc(ship.company)}</div>` : ''}
      <div class="line">${esc(ship.address1)}${ship.address2 ? `, ${esc(ship.address2)}` : ''}</div>
      <div class="line">${esc(ship.zip)} ${esc(ship.city)}</div>
      ${ship.phone ? `<div class="line strong">Tel: ${esc(ship.phone)}</div>` : ''}
    </div>
    <div class="box main-product">
      <div class="box-title">Main product</div>
      <div class="main-flex">
        ${mainThumb}
        <div>
          ${
            mainItem
              ? `<div class="main-product-title">${esc(truncate(mainItem.title, 80))}</div>
          ${mainItem.variant_title ? `<div class="small">${esc(truncate(mainItem.variant_title, 50))}</div>` : ''}
          <div class="tag">Qty ${esc(mainItem.quantity)}</div>`
              : '<div class="muted">No main product</div>'
          }
        </div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="box-title">Products / Add-ons ${extraCount ? `(+${extraCount} more)` : ''}</div>
    <table>
      <thead><tr><th>Product</th><th class="qty">Qty</th></tr></thead>
      <tbody>${productRows || '<tr><td colspan="2">No products</td></tr>'}</tbody>
    </table>
  </div>

  ${
    instructionRows
      ? `<div class="box info-box">
    <div class="box-title">Florist notes / Tilvalg</div>
    ${instructionRows}
  </div>`
      : ''
  }

  ${
    cardText
      ? `<div class="box card-box">
    <div class="box-title">Korttekst ${sender ? `· ${esc(truncate(sender, 40))}` : ''}</div>
    <div class="card-message">${esc(cardText)}</div>
  </div>`
      : ''
  }

  <div class="finance-bar">
    <span>Flower ${esc(money(flowerValue, currency))}</span>
    <span>Platform −${esc(money(platform, currency))}</span>
    <span>Delivery ${esc(money(delivery, currency))}</span>
    <span class="finance-total">Payout ${esc(money(payout, currency))}</span>
  </div>

  <div class="signature-area">
    <div class="check"><span class="square"></span>Product</div>
    <div class="check"><span class="square"></span>Card</div>
    <div class="check"><span class="square"></span>Add-ons</div>
    <div class="check"><span class="square"></span>Photo</div>
  </div>

  <div class="footer">
    <div>Northblomst · single-page production</div>
    <div>${esc(orderName)}</div>
  </div>
</div>`;
}

function renderPackingSlipHtml(payload) {
  const ctx = buildContext(payload);
  const orderName = ctx.orderName;

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
    <span class="no-print-hint">Optimized for 1× A4 — use “Print kort” for greeting/funeral cards.</span>
  </div>
  ${renderCompactSheet(ctx)}
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

module.exports = { renderPackingSlipHtml };
