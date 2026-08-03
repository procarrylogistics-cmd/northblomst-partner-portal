import { truncateCardMessage, extractSenderName, CARD_MESSAGE_CHAR_LIMIT } from './cardMessage';

export const CARD_VARIANTS = {
  normal: 'normal',
  funeral: 'funeral'
};

export const FUNERAL_CARD_CHAR_LIMIT = 500;

function logoUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/northblomst-logo-light.png`;
  }
  return '/northblomst-logo-light.png';
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orderLabel(order) {
  if (!order) return '';
  return order.shopifyOrderName || (order.shopifyOrderNumber ? `#${order.shopifyOrderNumber}` : order._id || '');
}

function openPrintWindow(title, html) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Tillad pop-ups for at printe korttekst.');
    return false;
  }
  win.document.write(html);
  win.document.close();
  return true;
}

function normalCardHtml({ text, orderName, senderName }) {
  const logo = logoUrl();
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <title>Korttekst ${orderName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      font-family: Arial, Helvetica, sans-serif;
      color: #1d1d1d; background: #fff;
    }
    .no-print { margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .no-print button {
      padding: 8px 14px; font-weight: 700; cursor: pointer;
      border: 1px solid #111; background: #111; color: #fff;
    }
    .no-print .hint { font-size: 12px; color: #555; }
    .print-area { max-width: 360px; margin: 0 auto; }
    .order-ref {
      text-align: center; font-size: 11px; font-weight: 900;
      letter-spacing: 0.4px; color: #333; margin-bottom: 4px; text-transform: uppercase;
    }
    .cut-line {
      margin: 12px 0 8px; border-top: 2px dashed #111;
      text-align: center; height: 10px;
    }
    .cut-line span {
      position: relative; top: -9px; background: #fff; padding: 0 10px;
      font-size: 9px; font-weight: 900; color: #333; letter-spacing: 0.5px; text-transform: uppercase;
    }
    .card {
      border: 2px dashed #111; border-radius: 10px; padding: 14px;
      background: #fffdf8; page-break-inside: avoid;
    }
    .logo-wrap { text-align: center; margin-bottom: 8px; }
    .logo { width: 110px; max-height: 40px; object-fit: contain; display: inline-block; }
    .brand {
      margin-top: 2px; font-size: 9px; font-weight: 800;
      letter-spacing: 0.5px; color: #6a5a35; text-transform: uppercase;
    }
    .card-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px;
      color: #6a5a35; font-weight: 900; margin-bottom: 8px; text-align: center;
    }
    .card-message {
      min-height: 72px; border: 1.5px solid #111; border-radius: 8px;
      background: #fff; padding: 12px 14px; font-size: 15px; line-height: 1.45;
      white-space: pre-wrap;
      font-family: "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive;
      color: #111;
    }
    .card-sender {
      margin-top: 10px; font-size: 11px; color: #111; font-weight: 800; text-align: center;
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
    <span class="hint">Normalt kort · klip langs den stiplede kant</span>
  </div>
  <div class="print-area">
    ${orderName ? `<div class="order-ref">Ordre: ${orderName}</div>` : ''}
    <div class="cut-line"><span>✂ Klip her · Korttekst</span></div>
    <div class="card">
      <div class="logo-wrap">
        <img class="logo" src="${logo}" alt="Northblomst" />
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
      function triggerPrint() { setTimeout(function () { window.print(); }, 350); }
      if (!img || img.complete) { triggerPrint(); return; }
      img.addEventListener('load', triggerPrint);
      img.addEventListener('error', triggerPrint);
    });
  </script>
</body>
</html>`;
}

/**
 * Small bi-fold funeral enclosure card (attaches with flowers).
 * Folded ~85×115 mm; flat ~85×230 mm — cut out from A4, then fold.
 * Top = black cover (printed upside-down); bottom = inside message.
 */
function funeralCardHtml({ text, orderName, senderName }) {
  const logo = logoUrl();
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <title>Begravelseskort ${orderName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      font-family: Georgia, "Times New Roman", serif;
      color: #1a1a1a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      padding: 12px 16px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
      border-bottom: 1px solid #ddd; background: #fafafa;
    }
    .no-print button {
      padding: 8px 14px; font-weight: 700; cursor: pointer;
      border: 1px solid #111; background: #111; color: #fff; font-family: Arial, sans-serif;
    }
    .no-print .hint {
      font-family: Arial, sans-serif; font-size: 12px; color: #444; max-width: 520px; line-height: 1.35;
    }
    .page {
      padding: 8mm 0 12mm;
      display: flex; flex-direction: column; align-items: center;
    }
    .order-ref {
      font-family: Arial, sans-serif; font-size: 10px; font-weight: 800;
      letter-spacing: 0.4px; color: #444; margin-bottom: 6px; text-transform: uppercase;
    }
    .cut-caption {
      font-family: Arial, sans-serif; font-size: 9px; font-weight: 800;
      letter-spacing: 0.6px; text-transform: uppercase; color: #555; margin: 4px 0 6px;
    }
    /* Folded size ~85×115 mm — small enough to attach with the bouquet */
    .card {
      width: 85mm;
      border: 1.5px dashed #333;
      position: relative;
      page-break-inside: avoid;
    }
    .fold {
      position: absolute; left: 0; right: 0; top: 50%; height: 0;
      border-top: 1px dashed rgba(184, 148, 83, 0.85);
      z-index: 2; pointer-events: none;
    }
    .fold-label {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-family: Arial, sans-serif; font-size: 7px; letter-spacing: 0.8px;
      text-transform: uppercase; color: #8a7a55; background: rgba(255,255,255,0.92);
      padding: 1px 7px; white-space: nowrap; z-index: 3;
    }
    .panel {
      width: 85mm; height: 115mm; padding: 10mm 8mm;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      text-align: center;
    }
    .cover {
      background: #0b0b0b; color: #e8dcc8;
      transform: rotate(180deg);
    }
    .cover-inner {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px;
    }
    .cross {
      width: 28px; height: 42px; position: relative;
    }
    .cross::before, .cross::after {
      content: ""; position: absolute; background: #d4c09a;
      left: 50%; top: 50%; transform: translate(-50%, -50%);
    }
    .cross::before { width: 4.5px; height: 42px; border-radius: 1px; }
    .cross::after { width: 24px; height: 4.5px; border-radius: 1px; top: 38%; }
    .cover-brand {
      font-size: 15px; letter-spacing: 1px; font-weight: 700;
      color: #f0e6d4;
    }
    .cover-emblem {
      width: 88px; max-height: 28px; object-fit: contain;
      filter: brightness(0) invert(1) sepia(0.25) saturate(0.4);
      opacity: 0.92;
    }
    .cover-line {
      width: 32px; height: 1px; background: rgba(212, 192, 154, 0.7); margin: 1px 0;
    }
    .cover-tag {
      font-size: 8px; letter-spacing: 1.6px; text-transform: uppercase;
      color: #b9a782; font-family: Arial, Helvetica, sans-serif;
    }
    .inside {
      background: linear-gradient(180deg, #fbf7ef 0%, #f3ebe0 100%);
      color: #1c1c1c;
    }
    .inside-eyebrow {
      font-size: 8px; letter-spacing: 1.6px; text-transform: uppercase;
      color: #8a7348; margin-bottom: 6px; font-weight: 600;
    }
    .inside-rule {
      width: 28px; height: 1px; background: #c4a86a; margin: 0 auto 8px;
    }
    .inside-message {
      font-size: 12.5px; line-height: 1.45; white-space: pre-wrap;
      max-width: 68mm; font-style: italic; color: #222;
    }
    .inside-sender {
      margin-top: 12px; font-size: 10px; font-style: normal;
      letter-spacing: 0.3px; color: #4a4030; font-weight: 700;
    }
    .inside-footer {
      margin-top: auto; padding-top: 8px;
      font-size: 8px; letter-spacing: 1.2px; text-transform: uppercase;
      color: #9a8a68;
    }
    @media print {
      .no-print { display: none !important; }
      .fold-label { display: none !important; }
      .page { padding-top: 4mm; }
    }
    @media screen {
      body { padding-bottom: 20px; }
      .card { box-shadow: 0 6px 20px rgba(0,0,0,0.14); }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()">Print</button>
    <span class="hint">
      Lille begravelseskort (~8,5 × 11,5 cm når det er foldet).
      <strong>Klip</strong> langs den stiplede kant, fold den sorte halvdel ned —
      til blomsterbuketten.
    </span>
  </div>
  <div class="page">
    ${orderName ? `<div class="order-ref">Ordre: ${orderName}</div>` : ''}
    <div class="cut-caption">✂ Klip her · lille foldet kort</div>
    <div class="card">
      <div class="fold"></div>
      <div class="fold-label">Fold</div>

      <div class="panel cover">
        <div class="cover-inner">
          <div class="cross" aria-hidden="true"></div>
          <div class="cover-line"></div>
          <img class="cover-emblem" src="${logo}" alt="Northblomst" />
          <div class="cover-brand">Northblomst</div>
          <div class="cover-tag">Med deltagelse</div>
        </div>
      </div>

      <div class="panel inside">
        <div class="inside-eyebrow">I kærlig erindring</div>
        <div class="inside-rule"></div>
        <div class="inside-message">${esc(text)}</div>
        ${senderName ? `<div class="inside-sender">${senderName}</div>` : ''}
        <div class="inside-footer">Northblomst</div>
      </div>
    </div>
    <div class="cut-caption">✂ Klip her</div>
  </div>
  <script>
    window.addEventListener('load', function () {
      var img = document.querySelector('.cover-emblem');
      function triggerPrint() { setTimeout(function () { window.print(); }, 400); }
      if (!img || img.complete) { triggerPrint(); return; }
      img.addEventListener('load', triggerPrint);
      img.addEventListener('error', triggerPrint);
    });
  </script>
</body>
</html>`;
}

/**
 * @param {object|null} order
 * @param {string} message
 * @param {{ variant?: 'normal'|'funeral', senderName?: string }} [options]
 */
export function printCardText(order, message, options = {}) {
  const variant = options.variant === CARD_VARIANTS.funeral ? CARD_VARIANTS.funeral : CARD_VARIANTS.normal;
  const limit = variant === CARD_VARIANTS.funeral ? FUNERAL_CARD_CHAR_LIMIT : CARD_MESSAGE_CHAR_LIMIT;
  const text = truncateCardMessage(message, limit);
  if (!text) return false;

  const orderName = esc(orderLabel(order));
  const senderName = esc(
    options.senderName != null ? String(options.senderName).trim() : extractSenderName(order)
  );

  const html =
    variant === CARD_VARIANTS.funeral
      ? funeralCardHtml({ text, orderName, senderName })
      : normalCardHtml({ text, orderName, senderName });

  return openPrintWindow(
    variant === CARD_VARIANTS.funeral ? `Begravelseskort ${orderName}` : `Korttekst ${orderName}`,
    html
  );
}

/** Manual print without an order (admin tool). */
export function printManualCard({ message, variant = CARD_VARIANTS.normal, senderName = '' } = {}) {
  return printCardText(null, message, { variant, senderName });
}
