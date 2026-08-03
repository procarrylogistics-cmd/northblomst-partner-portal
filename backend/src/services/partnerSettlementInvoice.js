const { COMPANY } = require('../config/company');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount) {
  return `${Number(amount || 0).toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} DKK`;
}

/**
 * Weekly settlement invoice HTML (reverse invoice / afregning).
 * Issued by Northblomst to document what to pay the partner.
 */
function renderPartnerSettlementInvoice({ partner, week, rows, totals, invoiceNumber }) {
  const orderRows = (rows || [])
    .map(
      (r) => `<tr>
      <td>${esc(r.orderNumber)}</td>
      <td>${esc(r.deliveryDate)}</td>
      <td>${esc(r.recipientName || '-')}</td>
      <td class="num">${esc(money(r.flowerValue))}</td>
      <td class="num">${esc(money(r.shipping))}</td>
      <td class="num">${esc(money(r.platformCommission))}</td>
      <td class="num"><strong>${esc(money(r.partnerPayout))}</strong></td>
    </tr>`
    )
    .join('');

  const partnerBlock = `
    <div class="party">
      <div class="party-label">Bill to / Partner</div>
      <div class="party-name">${esc(partner?.name || 'Partner')}</div>
      ${partner?.cvr ? `<div>CVR: ${esc(partner.cvr)}</div>` : '<div class="muted">CVR: —</div>'}
      ${partner?.address ? `<div>${esc(partner.address)}</div>` : ''}
      ${partner?.email ? `<div>${esc(partner.email)}</div>` : ''}
      ${partner?.phone ? `<div>${esc(partner.phone)}</div>` : ''}
      ${partner?.bankAccount ? `<div><strong>Bank:</strong> ${esc(partner.bankAccount)}</div>` : '<div class="muted">Bank account: —</div>'}
      ${partner?.bankName ? `<div>${esc(partner.bankName)}</div>` : ''}
    </div>`;

  const company = COMPANY;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Settlement ${esc(invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 28px;
      font-family: Georgia, "Times New Roman", serif;
      color: #1c1c1c; background: #fff;
      font-size: 13px; line-height: 1.4;
    }
    .sheet { max-width: 820px; margin: 0 auto; }
    .no-print { margin-bottom: 16px; display: flex; gap: 8px; }
    .no-print button {
      padding: 8px 14px; font-weight: 700; cursor: pointer;
      border: 1px solid #111; background: #111; color: #fff;
    }
    .no-print button.secondary { background: #fff; color: #111; }
    .top {
      display: grid; grid-template-columns: 1.2fr 1fr;
      gap: 20px; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 16px;
    }
    .brand-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 8px;
    }
    .brand-logo {
      width: 72px; height: 72px; object-fit: contain;
      background: #111; border-radius: 10px; padding: 6px;
    }
    .brand { font-size: 26px; font-weight: 700; letter-spacing: 0.5px; }
    .tagline {
      margin-top: 6px; color: #6a5a35; font-style: italic; font-size: 13px;
    }
    .meta { text-align: right; }
    .meta .doc-type {
      display: inline-block; background: #111; color: #fff;
      padding: 4px 10px; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
    }
    .parties {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;
    }
    .party {
      border: 1px solid #d8c28d; border-radius: 8px; padding: 12px; background: #fffdf8;
    }
    .party-label {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
      color: #6a5a35; font-weight: 700; margin-bottom: 4px;
    }
    .party-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .muted { color: #777; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th {
      text-align: left; font-size: 10px; text-transform: uppercase;
      border-bottom: 2px solid #111; padding: 6px 4px; color: #6a5a35;
    }
    td { border-bottom: 1px solid #eadfca; padding: 7px 4px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .totals {
      margin-top: 14px; display: grid; grid-template-columns: 1.4fr 260px; gap: 12px; align-items: start;
    }
    .totals table td { border: none; padding: 4px 2px; }
    .totals .grand td {
      border-top: 2px solid #111; padding-top: 8px; font-size: 15px; font-weight: 700;
    }
    .note {
      margin-top: 0; padding: 14px; border: 1px solid #d8c28d; border-radius: 10px;
      background: linear-gradient(135deg, #fff8ea 0%, #fffdf8 100%);
      font-size: 12.5px;
      display: grid; grid-template-columns: 88px 1fr; gap: 14px; align-items: center;
    }
    .note-logo {
      width: 88px; height: 88px; object-fit: contain;
      background: #111; border-radius: 12px; padding: 8px;
    }
    .note-tagline {
      color: #6a5a35; font-style: italic; font-weight: 700; margin-bottom: 6px; font-size: 13px;
    }
    .footer {
      margin-top: 22px; border-top: 1px solid #e3d9c5; padding-top: 8px;
      display: flex; justify-content: space-between; color: #666; font-size: 11px;
    }
    @media print {
      body { padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="no-print">
      <button type="button" onclick="window.print()">Print</button>
      <button type="button" class="secondary" onclick="window.close()">Close</button>
    </div>

    <div class="top">
      <div>
        <div class="brand-row">
          <img class="brand-logo" src="${esc(company.logoUrl)}" alt="Northblomst" />
          <div>
            <div class="brand">${esc(company.brandName)}</div>
            <div>${esc(company.legalName)}</div>
          </div>
        </div>
        <div>CVR ${esc(company.cvr)}</div>
        <div>${esc(company.address1)}</div>
        <div>${esc(company.address2)}</div>
        <div class="tagline">${esc(company.tagline)}</div>
      </div>
      <div class="meta">
        <div class="doc-type">Settlement invoice</div>
        <div style="margin-top:10px;"><strong>No.</strong> ${esc(invoiceNumber)}</div>
        <div><strong>Period</strong> ${esc(week?.from)} → ${esc(week?.to)}</div>
        <div><strong>Issued</strong> ${esc(new Date().toISOString().slice(0, 10))}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="party-label">From / Issuer</div>
        <div class="party-name">${esc(company.legalName)}</div>
        <div>CVR: ${esc(company.cvr)}</div>
        <div>${esc(company.address1)}</div>
        <div>${esc(company.address2)}</div>
        <div>${esc(company.website)}</div>
      </div>
      ${partnerBlock}
    </div>

    <p>
      This settlement document confirms deliveries for the selected week.
      Amounts use <strong>flower price</strong> after fees, with
      fixed delivery <strong>69 DKK</strong> per order and platform fee
      <strong>20%</strong> on flower price only.
    </p>

    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Date</th>
          <th>Recipient</th>
          <th class="num">Flower price</th>
          <th class="num">Delivery</th>
          <th class="num">Platform</th>
          <th class="num">Partner</th>
        </tr>
      </thead>
      <tbody>
        ${orderRows || '<tr><td colspan="7">No orders in this period</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      <div class="note">
        <img class="note-logo" src="${esc(company.logoUrl)}" alt="Northblomst" />
        <div>
          <div class="note-tagline">${esc(company.tagline)}</div>
          Thank you for delivering beautiful flowers with care.<br />
          Please use this settlement as the basis for payment —
          no separate partner invoice is required for this period.<br /><br />
          <strong>Payment terms:</strong> Payment is made within
          <strong>7 working days</strong> from the issue date of this settlement.
        </div>
      </div>
      <div>
        <table>
          <tr><td>Orders</td><td class="num">${esc(totals?.deliveries || 0)}</td></tr>
          <tr><td>Flower price</td><td class="num">${esc(money(totals?.flowerValue))}</td></tr>
          <tr><td>Delivery (69 DKK × orders)</td><td class="num">${esc(money(totals?.shipping))}</td></tr>
          <tr><td>Platform fee (20%)</td><td class="num">- ${esc(money(totals?.platformCommission))}</td></tr>
          <tr class="grand"><td>Amount to partner</td><td class="num">${esc(money(totals?.partnerPayout))}</td></tr>
        </table>
      </div>
    </div>

    <div class="footer">
      <div>${esc(company.legalName)} · CVR ${esc(company.cvr)}</div>
      <div>${esc(invoiceNumber)}</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      var imgs = document.querySelectorAll('img');
      var pending = 0;
      function maybeReady() {
        if (pending <= 0) return;
      }
      imgs.forEach(function (img) {
        if (!img.complete) {
          pending++;
          img.addEventListener('load', function () { pending--; });
          img.addEventListener('error', function () { pending--; });
        }
      });
    });
  </script>
</body>
</html>`;
}

module.exports = { renderPartnerSettlementInvoice };
