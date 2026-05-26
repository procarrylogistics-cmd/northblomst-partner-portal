/**
 * HTML packing slip (browser print) – same data/images as Shopify admin packing slip.
 */

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('da-DK');
  } catch {
    return '—';
  }
}

function renderPackingSlipHtml(order) {
  const orderName = order.shopifyOrderName || order.shopifyOrderNumber || order.orderNumber || '';
  const products = order.products || [];
  const addOns = order.addOns || [];
  const note = order.cardText || order.customer?.message || order.notes || '';

  const productRows = products
    .map((p) => {
      const img = p.imageUrl
        ? `<img src="${esc(p.imageUrl)}" alt="" width="56" height="56" style="object-fit:cover;border-radius:4px;" />`
        : '<div class="ph"></div>';
      return `<tr>
        <td class="thumb">${img}</td>
        <td>${esc(p.quantity || 1)}</td>
        <td>${esc(p.name)}</td>
      </tr>`;
    })
    .join('');

  const addOnRows = addOns
    .map((a) => {
      const line = `${a.label || ''}${a.value ? `: ${a.value}` : ''}${a.quantity > 1 ? ` (${a.quantity} stk)` : ''}`;
      return `<tr><td colspan="3">${esc(line)}</td></tr>`;
    })
    .join('');

  const total =
    order.totalPaidAmount != null
      ? `${Number(order.totalPaidAmount).toLocaleString('da-DK', { minimumFractionDigits: 2 })} ${order.currencyCode || 'DKK'}`
      : '';

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <title>Packing slip ${esc(orderName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: 0.02em; }
    .sub { font-size: 11px; color: #444; margin-bottom: 16px; }
    .sheet-title { font-size: 14px; font-weight: bold; margin: 12px 0 8px; text-transform: uppercase; }
    .meta { margin-bottom: 16px; line-height: 1.5; }
    .cols { display: flex; gap: 32px; margin-bottom: 20px; }
    .cols > div { flex: 1; }
    .cols h3 { font-size: 11px; text-transform: uppercase; margin: 0 0 6px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; font-size: 11px; text-transform: uppercase; }
    .thumb { width: 72px; }
    .ph { width: 56px; height: 56px; background: #eee; border-radius: 4px; }
    .note { border: 1px solid #ccc; padding: 12px; margin-top: 12px; white-space: pre-wrap; }
    @media print {
      body { margin: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <p class="no-print" style="margin-bottom:12px;">
    <button onclick="window.print()">Print</button>
  </p>
  <h1>NORTHBLOMST</h1>
  <p class="sub">northblomst.dk</p>
  <p class="sheet-title">Partner production sheet</p>
  <p class="sheet-title" style="margin-top:0;">Order ${esc(orderName)}</p>

  <div class="meta">
    <div><strong>Order date:</strong> ${esc(formatDate(order.orderDate || order.receivedAt))}</div>
    <div><strong>Delivery date:</strong> ${esc(formatDate(order.deliveryDate))}</div>
    ${total ? `<div><strong>Total:</strong> ${esc(total)}</div>` : ''}
  </div>

  <div class="cols">
    <div>
      <h3>Ship to</h3>
      <div>${esc(order.recipientName || order.customer?.name)}</div>
      <div>${esc(order.address || order.shippingAddress?.address1)}</div>
      <div>${esc([order.postcode || order.shippingAddress?.postalCode, order.city || order.shippingAddress?.city].filter(Boolean).join(' '))}</div>
      <div>${esc(order.phone || order.customer?.phone)}</div>
    </div>
    <div>
      <h3>Customer</h3>
      <div>${esc(order.customer?.name || order.recipientName)}</div>
      <div>${esc(order.customer?.email)}</div>
    </div>
  </div>

  <h3 class="sheet-title">Products / add-ons</h3>
  <table>
    <thead>
      <tr><th></th><th>Qty</th><th>Description</th></tr>
    </thead>
    <tbody>
      ${productRows || '<tr><td colspan="3">Ingen produkter</td></tr>'}
      ${addOnRows}
    </tbody>
  </table>

  ${note ? `<h3 class="sheet-title">Florist notes / card</h3><div class="note">${esc(note)}</div>` : ''}

  <script>window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });</script>
</body>
</html>`;
}

module.exports = { renderPackingSlipHtml };
