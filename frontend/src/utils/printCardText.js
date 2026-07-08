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

function recipientName(order) {
  return order.recipientName || order.customer?.name || order.shippingAddress?.name || '';
}

/**
 * Open a print window with only the greeting-card text in a cut-out box.
 */
export function printCardText(order, message) {
  const text = String(message || '').trim();
  if (!text) return false;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Tillad pop-ups for at printe korttekst.');
    return false;
  }

  const orderName = esc(orderLabel(order));
  const recipient = esc(recipientName(order));

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
    .card-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #6a5a35;
      font-weight: 900;
      margin-bottom: 8px;
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
    .card-meta {
      margin-top: 10px;
      font-size: 10px;
      color: #555;
      font-weight: 700;
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
    <div class="cut-line"><span>✂ Klip her · Korttekst</span></div>
    <div class="card">
      <div class="card-title">Greeting card</div>
      <div class="card-message">${esc(text)}</div>
      <div class="card-meta">Ordre: ${orderName}${recipient ? ` · ${recipient}` : ''}</div>
    </div>
    <div class="cut-line"><span>✂ Klip her</span></div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 350);
    });
  </script>
</body>
</html>`);
  win.document.close();
  return true;
}
