/**
 * Customer order invoice (faktura) with billing address — admin only.
 */

const axios = require('axios');
const { COMPANY } = require('../config/company');
const { splitInclusiveMoms } = require('../utils/orderFinance');
const { getShopifyCredentials } = require('../utils/shopify');
const ShopifyStore = require('../models/ShopifyStore');
const { sendMail } = require('./email');

const API_VERSION = '2024-10';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount, currency = 'DKK') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `0,00 ${currency}`;
  try {
    return new Intl.NumberFormat('da-DK', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

function mapBillingFromShopify(shopifyOrder) {
  const bill = shopifyOrder?.billing_address || {};
  const ship = shopifyOrder?.shipping_address || {};
  const cust = shopifyOrder?.customer || {};
  const src = bill.address1 ? bill : ship;
  const name =
    bill.name ||
    `${bill.first_name || ''} ${bill.last_name || ''}`.trim() ||
    `${cust.first_name || ''} ${cust.last_name || ''}`.trim() ||
    '';
  return {
    billingName: name,
    billingCompany: bill.company || '',
    billingAddress: {
      address1: src.address1 || '',
      address2: src.address2 || '',
      postalCode: src.zip || '',
      city: src.city || '',
      country: src.country || 'DK'
    },
    email: shopifyOrder?.email || cust.email || '',
    phone: bill.phone || src.phone || cust.phone || ''
  };
}

function billingFromMongo(order) {
  const ba = order.billingAddress || {};
  const hasBilling = !!(ba.address1 || order.billingName);
  const ship = order.shippingAddress || {};
  const fallbackName = order.billingName || order.recipientName || order.customer?.name || '';
  return {
    billingName: fallbackName,
    billingCompany: order.billingCompany || '',
    billingAddress: hasBilling
      ? ba
      : {
          address1: ship.address1 || order.address || '',
          address2: ship.address2 || '',
          postalCode: ship.postalCode || order.postcode || '',
          city: ship.city || order.city || '',
          country: ship.country || 'DK'
        },
    email: order.customer?.email || '',
    phone: order.phone || order.customer?.phone || ''
  };
}

async function getCredentialsForOrder(order) {
  const shop = order?.shop || '';
  if (shop) {
    const store = await ShopifyStore.findOne({ shop: String(shop).trim() });
    if (store?.accessToken) return { shop: store.shop, token: store.accessToken };
  }
  return getShopifyCredentials();
}

async function fetchShopifyOrder(order) {
  if (!order.shopifyOrderId) return null;
  const creds = await getCredentialsForOrder(order);
  if (!creds?.token) return null;
  try {
    const url = `https://${creds.shop}/admin/api/${API_VERSION}/orders/${order.shopifyOrderId}.json`;
    const { data } = await axios.get(url, {
      headers: { 'X-Shopify-Access-Token': creds.token },
      timeout: 20000
    });
    return data?.order || null;
  } catch (err) {
    console.warn('customer invoice: Shopify fetch failed', err.message);
    return null;
  }
}

function moneyAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function lineItemsFromShopify(shopifyOrder) {
  return (shopifyOrder?.line_items || []).map((li) => {
    const qty = li.quantity || 1;
    const unit = moneyAmount(li.price);
    const total =
      li.final_line_price != null
        ? moneyAmount(li.final_line_price)
        : li.line_price != null
          ? moneyAmount(li.line_price)
          : unit * qty;
    const title = [li.title, li.variant_title].filter(Boolean).join(' — ');
    return { title, quantity: qty, unitPrice: unit, lineTotal: total };
  });
}

/**
 * Shipping lines from Shopify — only include when price > 0
 * (free / included shipping is omitted).
 */
function shippingLinesFromShopify(shopifyOrder) {
  const lines = shopifyOrder?.shipping_lines || [];
  return lines
    .map((sl) => {
      const amount = moneyAmount(
        sl.discounted_price != null ? sl.discounted_price : sl.price
      );
      const title = String(sl.title || sl.code || 'Levering').trim() || 'Levering';
      return { title, quantity: 1, unitPrice: amount, lineTotal: amount, isShipping: true };
    })
    .filter((sl) => sl.lineTotal > 0);
}

function discountFromShopify(shopifyOrder) {
  const amount = moneyAmount(shopifyOrder?.total_discounts);
  if (amount <= 0) return null;
  const codes = (shopifyOrder?.discount_codes || [])
    .map((d) => d.code)
    .filter(Boolean)
    .join(', ');
  return {
    title: codes ? `Rabat (${codes})` : 'Rabat',
    amount
  };
}

function lineItemsFromMongo(order) {
  const total = moneyAmount(order.totalPaidAmount ?? order.totalPrice);
  const products = order.products || [];
  if (products.length === 0) {
    return [{ title: order.productSummary || 'Ordre', quantity: 1, unitPrice: total, lineTotal: total }];
  }
  const perItem = products.length ? total / products.length : total;
  return products.map((p) => ({
    title: p.name || 'Produkt',
    quantity: p.quantity || 1,
    unitPrice: perItem / (p.quantity || 1),
    lineTotal: perItem
  }));
}

function paidStatusLabel(financialStatus) {
  if (financialStatus === 'paid' || financialStatus === 'partially_paid') return 'Betalt';
  if (financialStatus === 'pending' || financialStatus === 'authorized') return 'Afventer betaling';
  if (financialStatus === 'refunded' || financialStatus === 'partially_refunded') return 'Refunderet';
  if (financialStatus === 'voided') return 'Annulleret';
  return 'Betaling registreret';
}

async function buildInvoiceContext(order) {
  const shopifyOrder = await fetchShopifyOrder(order);
  const billing = shopifyOrder ? mapBillingFromShopify(shopifyOrder) : billingFromMongo(order);
  const orderNumber =
    order.orderNumber || order.shopifyOrderName || order.shopifyOrderNumber || String(order._id);
  const invoiceNumber = `NB-${String(orderNumber).replace(/^#+/, '')}`;
  const currency = order.currencyCode || shopifyOrder?.currency || 'DKK';
  const productLines = shopifyOrder ? lineItemsFromShopify(shopifyOrder) : lineItemsFromMongo(order);
  const shippingLines = shopifyOrder ? shippingLinesFromShopify(shopifyOrder) : [];
  const discount = shopifyOrder ? discountFromShopify(shopifyOrder) : null;
  const lineItems = [...productLines, ...shippingLines];
  const subtotalFromLines = lineItems.reduce((s, li) => s + (li.lineTotal || 0), 0);
  const totalIncl =
    moneyAmount(shopifyOrder?.total_price ?? order.totalPaidAmount ?? order.totalPrice) ||
    Math.max(0, subtotalFromLines - (discount?.amount || 0));
  const moms = splitInclusiveMoms(totalIncl);
  const financialStatus = shopifyOrder?.financial_status || 'paid';
  const orderDate = order.orderDate || order.receivedAt || shopifyOrder?.created_at;

  return {
    order,
    shopifyOrder,
    billing,
    orderNumber,
    invoiceNumber,
    currency,
    lineItems,
    shippingLines,
    discount,
    totalIncl,
    moms,
    financialStatus,
    orderDate
  };
}

function renderCustomerOrderInvoice(ctx) {
  const {
    billing,
    orderNumber,
    invoiceNumber,
    currency,
    lineItems,
    discount,
    totalIncl,
    moms,
    financialStatus,
    orderDate
  } = ctx;
  const ba = billing.billingAddress || {};
  const addrLines = [
    ba.address1,
    ba.address2,
    [ba.postalCode, ba.city].filter(Boolean).join(' '),
    ba.country
  ].filter(Boolean);

  const rows = lineItems
    .map(
      (li) => `<tr${li.isShipping ? ' class="ship-row"' : ''}>
      <td>${esc(li.title)}</td>
      <td class="num">${esc(li.quantity)}</td>
      <td class="num">${esc(money(li.unitPrice, currency))}</td>
      <td class="num">${esc(money(li.lineTotal, currency))}</td>
    </tr>`
    )
    .join('');

  const discountRow = discount
    ? `<div><span>${esc(discount.title)}</span><span>- ${esc(money(discount.amount, currency))}</span></div>`
    : '';

  const paidLabel = paidStatusLabel(financialStatus);

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <title>Faktura ${esc(invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 28px;
      font-family: Georgia, "Times New Roman", serif;
      color: #1c1c1c; background: #fff;
      font-size: 13px; line-height: 1.45;
    }
    .sheet { max-width: 820px; margin: 0 auto; }
    .no-print { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
    .no-print button {
      padding: 8px 14px; font-weight: 700; cursor: pointer;
      border: 1px solid #1a4a3c; background: #1a4a3c; color: #fff; border-radius: 6px;
    }
    .top {
      display: grid; grid-template-columns: 1.2fr 1fr;
      gap: 20px; border-bottom: 2px solid #1a4a3c; padding-bottom: 14px; margin-bottom: 16px;
    }
    .brand-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .brand-row img { height: 44px; width: auto; }
    .doc-type { font-size: 22px; font-weight: 700; letter-spacing: 0.04em; }
    .party { margin-bottom: 12px; }
    .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #666; margin-bottom: 4px; }
    .party-name { font-weight: 700; font-size: 15px; }
    .meta-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;
      margin: 16px 0; padding: 12px; background: #f7f8f6; border-radius: 8px;
    }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; vertical-align: top; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
    .num { text-align: right; white-space: nowrap; }
    tr.ship-row td { font-style: italic; color: #333; }
    .totals { margin-left: auto; width: min(100%, 320px); }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals .grand { font-weight: 700; font-size: 15px; border-top: 2px solid #1a4a3c; margin-top: 6px; padding-top: 8px; }
    .foot { margin-top: 24px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 12px; }
    .muted { color: #666; }
    @media print {
      body { padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="no-print">
      <button type="button" onclick="window.print()">Print / Gem som PDF</button>
      <span class="muted">Faktura ${esc(invoiceNumber)} · Ordre ${esc(orderNumber)}</span>
    </div>
    <div class="top">
      <div>
        <div class="brand-row">
          ${COMPANY.logoUrl ? `<img src="${COMPANY.logoUrl}" alt="Northblomst" />` : ''}
          <div>
            <div class="doc-type">FAKTURA</div>
            <div class="muted">${esc(COMPANY.tagline || '')}</div>
          </div>
        </div>
        <div class="party">
          <div class="party-label">Leverandør</div>
          <div class="party-name">${esc(COMPANY.brandName)}</div>
          <div>CVR: ${esc(COMPANY.cvr)}</div>
          <div>${esc(COMPANY.address1)}</div>
          <div>${esc(COMPANY.address2)}</div>
          <div>${esc(COMPANY.email)} · ${esc(COMPANY.website)}</div>
        </div>
      </div>
      <div>
        <div class="party">
          <div class="party-label">Faktureres til (Billing)</div>
          <div class="party-name">${esc(billing.billingName || '—')}</div>
          ${billing.billingCompany ? `<div>${esc(billing.billingCompany)}</div>` : ''}
          ${addrLines.map((l) => `<div>${esc(l)}</div>`).join('')}
          ${billing.email ? `<div>${esc(billing.email)}</div>` : ''}
          ${billing.phone ? `<div>Tlf: ${esc(billing.phone)}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="meta-grid">
      <div><strong>Fakturanr.</strong><br />${esc(invoiceNumber)}</div>
      <div><strong>Ordrenr.</strong><br />${esc(orderNumber)}</div>
      <div><strong>Fakturadato</strong><br />${esc(fmtDate(new Date()))}</div>
      <div><strong>Ordredato</strong><br />${esc(fmtDate(orderDate))}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Beskrivelse</th>
          <th class="num">Antal</th>
          <th class="num">Pris</th>
          <th class="num">Beløb</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      ${discountRow}
      <div><span>Subtotal ekskl. MOMS</span><span>${esc(money(moms.exclusive, currency))}</span></div>
      <div><span>MOMS (${esc(moms.momsPercent)}%)</span><span>${esc(money(moms.moms, currency))}</span></div>
      <div class="grand"><span>Total inkl. MOMS</span><span>${esc(money(totalIncl, currency))}</span></div>
      <div class="muted" style="margin-top:8px;font-size:12px;">${esc(paidLabel)}</div>
    </div>
    <div class="foot">
      Momsregistreret selskab · CVR ${esc(COMPANY.cvr)} · ${esc(COMPANY.brandName)}<br />
      Denne faktura er udstedt for ordre ${esc(orderNumber)}.
    </div>
  </div>
</body>
</html>`;
}

async function buildCustomerInvoiceHtml(order) {
  const ctx = await buildInvoiceContext(order);
  return { html: renderCustomerOrderInvoice(ctx), ctx };
}

async function sendCustomerInvoice(order, toEmail) {
  const { html, ctx } = await buildCustomerInvoiceHtml(order);
  const to = String(toEmail || ctx.billing.email || order.customer?.email || '').trim();
  if (!to) {
    return { ok: false, error: 'Ingen e-mail på ordren — angiv modtager manuelt.' };
  }
  const orderNumber = ctx.orderNumber;
  const result = await sendMail({
    to,
    subject: `Faktura ${ctx.invoiceNumber} — Northblomst ordre ${orderNumber}`,
    html
  });
  if (!result?.ok) {
    return { ok: false, error: result?.error || 'Kunne ikke sende e-mail' };
  }
  return { ok: true, to, invoiceNumber: ctx.invoiceNumber };
}

module.exports = {
  buildCustomerInvoiceHtml,
  sendCustomerInvoice,
  mapBillingFromShopify
};
