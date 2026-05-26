/**
 * Partner production sheet HTML – port of Shopify packing slip Liquid template.
 */

const { PACKING_SLIP_CSS, LOGO_URL } = require('./packingSlipStyles');
const { pickMainLineItem } = require('./shopifyPackingSlipData');

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

function renderPropertiesHtml(properties) {
  if (!properties?.length) return '<div class="muted">No properties.</div>';
  return properties
    .filter((p) => p.name && !String(p.name).startsWith('_'))
    .map((p) => `<strong>${esc(p.name)}:</strong>\n${esc(p.value)}`)
    .join('\n\n');
}

function renderNoteAttributes(attrs) {
  if (!attrs?.length) return '';
  return attrs
    .filter((a) => a.name && a.value != null && !String(a.name).startsWith('_'))
    .map((a) => `<strong>${esc(a.name)}:</strong>\n${esc(a.value)}`)
    .join('\n\n');
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
  const bill = so.billing_address || ship;
  const customer = so.customer || mongo.customer || {};
  const orderName = so.name || mongo.shopifyOrderName || `#${mongo.shopifyOrderNumber || ''}`;
  const createdAt = so.created_at || mongo.orderDate || mongo.receivedAt;
  const note = so.note || mongo.notes || mongo.cardText || '';
  const noteAttributes = so.note_attributes || [];
  const mainItem = pickMainLineItem(lineItems);

  const subtotal = so.subtotal_price != null ? parseFloat(so.subtotal_price) : mongo.totalPaidAmount;
  const shipping = so.total_shipping_price_set?.shop_money?.amount ?? so.shipping_lines?.[0]?.price ?? 0;
  const total = so.total_price != null ? parseFloat(so.total_price) : mongo.totalPaidAmount;

  return {
    lineItems,
    mainItem,
    ship,
    bill,
    customer,
    orderName,
    createdAt,
    note,
    noteAttributes,
    mongo,
    currency,
    subtotal,
    shipping: parseFloat(shipping) || 0,
    total
  };
}

function renderPage1(ctx) {
  const {
    lineItems, mainItem, ship, bill, customer, orderName, createdAt, currency, subtotal, shipping, total
  } = ctx;

  const productRows = lineItems
    .map((li) => {
      const thumb = imgTag(li, 'thumb');
      const price = money(li.line_total, currency);
      return `<tr>
        <td>
          <div class="product-flex">
            <div>${thumb}</div>
            <div>
              <div class="product-name">${esc(li.title)}</div>
              ${li.variant_title ? `<div class="small">Variant: ${esc(li.variant_title)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="qty">${esc(li.quantity)}</td>
        <td class="price">${esc(price)}</td>
      </tr>`;
    })
    .join('');

  const mainImg = mainItem && (mainItem.imageDataUri || mainItem.imageUrl)
    ? imgTag(mainItem, 'main-img')
    : '<div class="no-img">No product image</div>';

  return `<div class="page">
  <div class="top-border"></div>
  <div class="header">
    <div class="logo-wrap">
      <img class="logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
      <div class="logo-site">northblomst.dk</div>
    </div>
    <div class="doc-title">
      <h1>Partner Production Sheet</h1>
      <p>Page 1 · Order overview · Product control</p>
    </div>
    <div class="status-box">
      <div class="status-pill">Internal copy</div>
      <div><strong>Printed:</strong> ${esc(fmtDateTime())}</div>
    </div>
  </div>

  <div class="order-row">
    <div class="mini"><div class="label">Order</div><div class="value">${esc(orderName)}</div></div>
    <div class="mini"><div class="label">Order date</div><div class="value">${esc(fmtDate(createdAt))}</div></div>
    <div class="mini"><div class="label">Items</div><div class="value">${lineItems.length}</div></div>
    <div class="mini"><div class="label">Total</div><div class="value">${esc(money(total, currency))}</div></div>
  </div>

  <div class="grid-2">
    <div class="box">
      <div class="box-title">Recipient / Delivery address</div>
      <div class="name">${esc(ship.name)}</div>
      ${ship.company ? `<div class="line">${esc(ship.company)}</div>` : ''}
      <div class="line">${esc(ship.address1)}</div>
      ${ship.address2 ? `<div class="line">${esc(ship.address2)}</div>` : ''}
      <div class="line">${esc(ship.zip)} ${esc(ship.city)}</div>
      <div class="line">${esc(ship.country)}</div>
      ${ship.phone ? `<div class="line" style="margin-top:4px;"><span class="strong">Phone:</span> ${esc(ship.phone)}</div>` : ''}
    </div>
    <div class="box">
      <div class="box-title">Customer / Ordered by</div>
      <div class="name">${esc(bill.name || customer.name || ship.name)}</div>
      ${customer.email ? `<div class="line"><span class="strong">Email:</span> ${esc(customer.email)}</div>` : ''}
      ${bill.phone ? `<div class="line"><span class="strong">Phone:</span> ${esc(bill.phone)}</div>` : ''}
      ${bill.address1 ? `<div class="line" style="margin-top:4px;">${esc(bill.address1)}</div>` : ''}
      ${bill.address2 ? `<div class="line">${esc(bill.address2)}</div>` : ''}
      ${bill.zip ? `<div class="line">${esc(bill.zip)} ${esc(bill.city)}</div>` : ''}
      ${bill.country ? `<div class="line">${esc(bill.country)}</div>` : ''}
    </div>
  </div>

  <div class="main-area">
    <div class="main-image-card">${mainImg}</div>
    <div class="box">
      <div class="box-title">Main product / Florist instruction</div>
      ${
        mainItem
          ? `<div class="main-product-title">${esc(mainItem.title)}</div>
      ${mainItem.variant_title ? `<div class="tag">Variant: ${esc(mainItem.variant_title)}</div>` : ''}
      <div class="tag">Qty: ${esc(mainItem.quantity)}</div>
      <div class="tag">Price: ${esc(money(mainItem.line_total, currency))}</div>`
          : '<div class="muted">No main product</div>'
      }
    </div>
  </div>

  <div class="box">
    <div class="box-title">Products / Add-ons / Internal price control</div>
    <table>
      <thead><tr><th>Product</th><th class="qty">Qty</th><th class="price">Price</th></tr></thead>
      <tbody>${productRows || '<tr><td colspan="3">No products</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div></div>
      <div>
        <table class="summary">
          <tr><td class="s-label">Subtotal</td><td class="s-value">${esc(money(subtotal, currency))}</td></tr>
          <tr><td class="s-label">Shipping</td><td class="s-value">${esc(money(shipping, currency))}</td></tr>
          <tr><td class="s-label">Total paid</td><td class="s-value">${esc(money(total, currency))}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <div class="signature-area">
    <div class="check"><span class="square"></span>Product checked</div>
    <div class="check"><span class="square"></span>Card/message</div>
    <div class="check"><span class="square"></span>Add-ons packed</div>
    <div class="check"><span class="square"></span>Photo taken</div>
  </div>

  <div class="cut"><span>CUT HERE · TEAR-OFF PRODUCTION SLIP</span></div>
  <div class="tear">
    <div class="tear-grid">
      <div>
        <div class="tear-title">Order</div>
        <div class="tear-big">${esc(orderName)}</div>
        <div>${esc(fmtDate(createdAt))}</div>
        <div style="margin-top:3px;"><strong>${esc(ship.name)}</strong></div>
        <div>${esc(ship.zip)} ${esc(ship.city)}</div>
      </div>
      <div>
        <div class="tear-title">Product to make</div>
        ${
          mainItem
            ? `<div class="tear-big">${esc(mainItem.title)}</div>
        ${mainItem.variant_title ? `<div>Variant: ${esc(mainItem.variant_title)}</div>` : ''}
        <div>Qty: ${esc(mainItem.quantity)}</div>`
            : ''
        }
      </div>
      <div>
        <div class="tear-title">Production status</div>
        <div><span class="square"></span>Made</div>
        <div><span class="square"></span>Card</div>
        <div><span class="square"></span>Add-ons</div>
        <div><span class="square"></span>Ready</div>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>Northblomst · northblomst.dk · Internal partner production document</div>
    <div>${esc(orderName)}</div>
  </div>
</div>`;
}

function renderPage2(ctx) {
  const { lineItems, mainItem, ship, orderName, note, noteAttributes, mongo } = ctx;

  const allProps = lineItems
    .filter((li) => li.properties?.length)
    .map(
      (li) =>
        `<strong>${esc(li.title)}</strong>\n${li.properties
          .map((p) => `${esc(p.name)}: ${esc(p.value)}`)
          .join('\n')}`
    )
    .join('\n\n');

  const mainProps = mainItem ? renderPropertiesHtml(mainItem.properties) : 'No main product properties.';
  const attrsHtml = renderNoteAttributes(noteAttributes);
  const mongoAddons = (mongo.addOns || [])
    .map((a) => `${esc(a.label)}${a.value ? `: ${esc(a.value)}` : ''}`)
    .join('\n');

  const deliveryNote = mongo.addOnsSummary || mongo.cardText || '';

  return `<div class="page">
  <div class="top-border"></div>
  <div class="header">
    <div class="logo-wrap">
      <img class="logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
      <div class="logo-site">northblomst.dk</div>
    </div>
    <div class="doc-title">
      <h1>Terminal Instructions</h1>
      <p>Page 2 · Notes · Attributes · Card message</p>
    </div>
    <div class="status-box">
      <div class="status-pill">Very important</div>
      <div><strong>Order:</strong> ${esc(orderName)}</div>
    </div>
  </div>

  <div class="terminal-note-box">
    <div class="terminal-note-title">IMPORTANT TERMINAL NOTE / WHAT TO PREPARE</div>

    <div class="terminal-section">
      <div class="terminal-section-title">Order note</div>
      <div class="terminal-text-large">${note ? esc(note) : 'No order note.'}</div>
    </div>

    ${
      attrsHtml
        ? `<div class="terminal-section">
      <div class="terminal-section-title">Note attributes / Custom order details</div>
      <div class="terminal-text">${attrsHtml}</div>
    </div>`
        : ''
    }

    ${
      mongoAddons
        ? `<div class="terminal-section">
      <div class="terminal-section-title">Portal add-ons</div>
      <div class="terminal-text">${mongoAddons}</div>
    </div>`
        : ''
    }

    ${
      deliveryNote && deliveryNote !== note
        ? `<div class="terminal-section">
      <div class="terminal-section-title">Delivery / card</div>
      <div class="terminal-text-large">${esc(deliveryNote)}</div>
    </div>`
        : ''
    }

    <div class="terminal-grid-2">
      <div class="terminal-section">
        <div class="terminal-section-title">Main product properties</div>
        <div class="terminal-text">${mainProps}</div>
      </div>
      <div class="terminal-section">
        <div class="terminal-section-title">All product attributes / Add-ons</div>
        <div class="terminal-text">${allProps || 'No line item properties.'}</div>
      </div>
    </div>
  </div>

  <div class="signature-area">
    <div class="check"><span class="square"></span>Instructions read</div>
    <div class="check"><span class="square"></span>Bouquet style followed</div>
    <div class="check"><span class="square"></span>Card message written</div>
    <div class="check"><span class="square"></span>Ready for delivery</div>
  </div>

  <div class="cut"><span>CUT HERE · TERMINAL NOTE COPY</span></div>
  <div class="tear">
    <div class="tear-grid">
      <div>
        <div class="tear-title">Order</div>
        <div class="tear-big">${esc(orderName)}</div>
        <div><strong>${esc(ship.name)}</strong></div>
        <div>${esc(ship.zip)} ${esc(ship.city)}</div>
      </div>
      <div>
        <div class="tear-title">Main note</div>
        <div>${esc(String(note || mongo.cardText || '').slice(0, 160))}</div>
      </div>
      <div>
        <div class="tear-title">Done</div>
        <div><span class="square"></span>Made</div>
        <div><span class="square"></span>Card</div>
        <div><span class="square"></span>Photo</div>
        <div><span class="square"></span>Ready</div>
      </div>
    </div>
  </div>
  <div class="footer">
    <div>Northblomst · northblomst.dk · Terminal instruction page</div>
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
  <title>Packing slip ${esc(orderName)}</title>
  <style>${PACKING_SLIP_CSS}</style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()">Print</button>
  </div>
  ${renderPage1(ctx)}
  ${renderPage2(ctx)}
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
        if (pending <= 0) setTimeout(function () { window.print(); }, 300);
      }
      if (pending === 0) setTimeout(function () { window.print(); }, 500);
    });
  </script>
</body>
</html>`;
}

module.exports = { renderPackingSlipHtml };
