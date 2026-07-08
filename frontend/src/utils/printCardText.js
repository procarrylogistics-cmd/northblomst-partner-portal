import { truncateCardMessage, extractSenderName } from './cardMessage';

const LOGO_URL =
  'https://cdn.shopify.com/s/files/1/1000/9988/3340/files/ChatGPT_Image_May_13_2026_10_26_32_AM_6d7e7b69-8370-482f-8ba2-2810758cce46.png?v=1778699581';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orderLabel(order) {
  return order.shopifyOrderName || (order.shopifyOrderNumber ? `#${order.shopifyOrderNumber}` : order._id || '');
}

/**
 * Open a print window with only the greeting-card text in a cut-out box.
 */
export function printCardText(order, message) {
  const text = truncateCardMessage(message);
  if (!text) return false;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Tillad pop-ups for at printe korttekst.');
    return false;
  }

  const orderName = esc(orderLabel(order));
  const senderName = esc(extractSenderName(order));

  win.document.write(`<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <title>Korttekst ${orderName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, Helvetica, sans-serif;
      color: #1d1d1d;
      background: #fff;
    }
    .no-print { margin-bottom: 16px; }
    .no-print button {
      padding: 8px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .print-area {
      max-width: 360px;
      margin: 0 auto;
    }
    .order-ref {
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.4px;
      color: #333;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .cut-line {
      margin: 12px 0 8px;
      border-top: 2px dashed #111;
      text-align: center;
      height: 10px;
    }
    .cut-line span {
      position: relative;
      top: -9px;
      background: #fff;
      padding: 0 10px;
      font-size: 9px;
      font-weight: 900;
      color: #333;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .card {
      border: 2px dashed #111;
      border-radius: 10px;
      padding: 14px;
      background: #fffdf8;
      page-break-inside: avoid;
    }
    .logo-wrap {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo {
      width: 96px;
      max-height: 48px;
      object-fit: contain;
      display: inline-block;
    }
    .brand {
      margin-top: 2px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #6a5a35;
      text-transform: uppercase;
    }
    .card-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #6a5a35;
      font-weight: 900;
      margin-bottom: 8px;
      text-align: center;
    }
    .card-message {
      min-height: 72px;
      border: 1.5px solid #111;
      border-radius: 8px;
      background: #fff;
      padding: 12px 14px;
      font-size: 15px;
      line-height: 1.45;
      white-space: pre-wrap;
      font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive;
      color: #111;
    }
    .card-sender {
      margin-top: 10px;
      font-size: 11px;
      color: #111;
      font-weight: 800;
      text-align: center;
    }
    @media print {
      body { padding: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <div class="print-area">
    <div class="order-ref">Ordre: ${orderName}</div>
    <div class="cut-line"><span>✂ Klip her · Korttekst</span></div>
    <div class="card">
      <div class="logo-wrap">
        <img class="logo" src="${LOGO_URL}" alt="Northblomst" />
        <div class="brand">Northblomst</div>
      </div>
      <div class="card-title">Greeting card</div>
      <div class="card-message">${esc(text)}</div>
      ${senderName ? `<div class="card-sender">${senderName}</div>` : ''}
    </div>
    <div class="cut-line"><span>✂ Klip her</span></div>
  </div>
  <script>
    window.addEventListener('load', function () {
      var img = document.querySelector('.logo');
      function triggerPrint() {
        setTimeout(function () { window.print(); }, 350);
      }
      if (!img || img.complete) {
        triggerPrint();
        return;
      }
      img.addEventListener('load', triggerPrint);
      img.addEventListener('error', triggerPrint);
    });
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}
