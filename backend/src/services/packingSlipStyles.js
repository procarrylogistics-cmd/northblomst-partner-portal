const fs = require('fs');
const path = require('path');

/** Single-page production sheet + 4 cut-out cards on A4 */
module.exports.PACKING_SLIP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Great+Vibes&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap');
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #1d1d1d; font-size: 10.5px; line-height: 1.25; background: #fff;
  }
  .page {
    width: 100%;
    max-width: 210mm;
    padding: 6px 8px;
    page-break-after: auto;
  }
  .header {
    display: grid; grid-template-columns: 95px 1fr 78px; align-items: center;
    gap: 6px; border-bottom: 1.5px solid #1c1c1c; padding-bottom: 4px; margin-bottom: 5px;
  }
  .logo { width: 90px; max-height: 32px; object-fit: contain; display: block; }
  .doc-title { text-align: center; }
  .doc-title h1 { margin: 0; font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; }
  .doc-title p { margin: 1px 0 0; font-size: 9.5px; color: #6a5a35; font-weight: 700; }
  .status-box { text-align: right; font-size: 9px; }
  .status-pill {
    display: inline-block; background: #111; color: #fff; padding: 2px 6px;
    border-radius: 99px; font-size: 8px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px;
  }
  .order-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px; margin-bottom: 5px; }
  .mini {
    border: 1px solid #d2c7af; border-radius: 5px; padding: 4px 6px; background: #fffdf8;
  }
  .label {
    font-size: 8px; color: #7b6a43; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.3px; margin-bottom: 1px;
  }
  .value { font-size: 12px; font-weight: 900; color: #111; }
  .produce-box {
    border: 1.5px solid #111; border-radius: 6px; background: #fff8ea;
    padding: 8px 8px; margin-bottom: 6px;
  }
  .produce-title {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.7px;
    font-weight: 900; color: #6a5a35; margin-bottom: 5px;
  }
  .produce-flex { display: flex; gap: 12px; align-items: flex-start; }
  .main-img {
    width: 118px; height: 118px; object-fit: cover; border-radius: 6px;
    border: 1px solid #d2c7af; flex-shrink: 0; display: block; background: #fff;
  }
  .main-img.no-img {
    display: flex; align-items: center; justify-content: center;
    background: #f6f2e9; color: #888; font-size: 10px; font-weight: 700;
  }
  .main-product-title { font-size: 15px; font-weight: 900; margin-bottom: 3px; line-height: 1.15; }
  .tag {
    display: inline-block; border: 1px solid #b89453; color: #5f4a1c; background: #fff;
    border-radius: 99px; padding: 2px 8px; font-size: 10px; font-weight: 900;
    margin-right: 4px; margin-top: 3px;
  }
  .grid-2 { display: grid; grid-template-columns: 1.15fr 0.95fr; gap: 5px; margin-bottom: 5px; }
  .box {
    border: 1px solid #d2c7af; border-radius: 5px; background: #fffdf8;
    padding: 5px 6px; margin-bottom: 5px;
  }
  .box-title {
    font-size: 8.5px; color: #6a5a35; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.4px; border-bottom: 1px solid #e3d9c5; padding-bottom: 2px; margin-bottom: 3px;
  }
  .name { font-size: 12px; font-weight: 900; margin-bottom: 1px; }
  .line { margin-bottom: 0; font-size: 10.5px; }
  .strong { font-weight: 900; }
  .muted { color: #777; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 8px; text-transform: uppercase; color: #6a5a35;
    border-bottom: 1.4px solid #111; padding: 2px 2px; font-weight: 900;
  }
  td { border-bottom: 1px solid #eadfca; padding: 3px 2px; vertical-align: top; font-size: 10.5px; }
  .product-name { font-weight: 800; font-size: 11px; }
  .small { font-size: 9.5px; color: #555; }
  .qty { width: 36px; text-align: center; font-weight: 900; font-size: 12px; }
  .info-row {
    display: grid; grid-template-columns: 110px 1fr; gap: 4px;
    padding: 2px 0; border-bottom: 1px dotted #e8dfcf;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { font-size: 8.5px; font-weight: 800; color: #6a5a35; text-transform: uppercase; }
  .info-value { font-size: 10.5px; font-weight: 700; color: #111; word-break: break-word; }
  .summary { width: 100%; }
  .summary td { padding: 1.5px 2px; border-bottom: 1px solid #eadfca; font-size: 10px; }
  .summary .s-label { font-weight: 800; }
  .summary .s-value { text-align: right; font-weight: 900; white-space: nowrap; }
  .summary .total td {
    border-top: 1.5px solid #111; border-bottom: none; padding-top: 3px;
    font-size: 11.5px; font-weight: 900;
  }
  .signature-area { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin: 4px 0 2px; }
  .check {
    border: 1px solid #d2c7af; background: #fffdf8; border-radius: 4px;
    padding: 3px 4px; font-size: 9px; font-weight: 700;
  }
  .square {
    display: inline-block; width: 9px; height: 9px; border: 1.4px solid #111;
    margin-right: 3px; vertical-align: middle;
  }
  .footer {
    margin-top: 4px; border-top: 1px solid #e3d9c5; padding-top: 3px;
    display: flex; justify-content: space-between; color: #777; font-size: 8px;
  }

  /* ——— 4 cut-out cards ——— */
  .cards-cut {
    margin: 6px 0 3px; border-top: 1.5px dashed #111; text-align: center; height: 9px;
  }
  .cards-cut span {
    position: relative; top: -7px; background: #fff; padding: 0 6px;
    font-size: 7.5px; font-weight: 900; color: #333; letter-spacing: 0.3px;
    text-transform: uppercase;
  }
  .cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 8px;
    width: 100%;
    align-items: stretch;
  }
  .cut-card {
    border: 1.4px dashed #222;
    border-radius: 3px;
    background: #fff;
    height: 46mm;
    min-height: 46mm;
    max-height: 46mm;
    overflow: hidden;
    page-break-inside: avoid;
    position: relative;
  }
  .cut-card-tag {
    position: absolute; top: 2px; left: 3px; z-index: 2;
    font-size: 6px; font-weight: 800; letter-spacing: 0.35px; text-transform: uppercase;
    color: #888; background: rgba(255,255,255,0.9); padding: 0 3px; border-radius: 2px;
  }

  /* 1 — Delivery / QR */
  .card-delivery { display: grid; grid-template-columns: 1.25fr 0.75fr; height: 100%; }
  .cd-left { display: flex; flex-direction: column; border-right: 1px solid #111; min-width: 0; }
  .cd-body { padding: 10px 6px 3px; flex: 1; }
  .cd-name { font-size: 11px; font-weight: 900; line-height: 1.1; margin-bottom: 2px; }
  .cd-line { font-size: 9px; line-height: 1.2; }
  .cd-date { margin-top: 3px; font-size: 9.5px; font-weight: 800; }
  .cd-foot {
    border-top: 1px solid #111; padding: 2px 5px 3px; background: #fafafa;
  }
  .cd-brand { font-size: 9px; font-weight: 900; }
  .cd-muted { font-size: 7.5px; color: #444; }
  .cd-right {
    padding: 10px 4px 3px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; min-width: 0;
  }
  .cd-order { font-size: 9.5px; font-weight: 900; margin-bottom: 2px; }
  .cd-qr-title { font-size: 7px; font-weight: 800; margin-bottom: 2px; }
  .cd-qr {
    width: 34px; height: 34px; display: block; margin: 0 auto;
  }
  .cd-barcode { margin-top: 2px; font-size: 7.5px; font-weight: 800; word-break: break-all; line-height: 1.1; }
  .cd-logo { margin-top: 3px; width: 42px; max-height: 12px; object-fit: contain; opacity: 0.9; }

  /* 2 — Visitkort / promo business card */
  .card-brand {
    height: 100%;
    background: linear-gradient(165deg, #ffffff 0%, #f8f5ef 50%, #f0ebe2 100%);
    padding: 0;
  }
  .cb-inner {
    height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 9px 7px 5px;
  }
  .cb-logo {
    width: 56px; max-height: 18px; object-fit: contain; margin: 0 0 2px; display: block;
  }
  .cb-script {
    font-family: 'Great Vibes', Georgia, cursive;
    font-size: 17px; color: #1a3a2e; line-height: 1; margin: 0;
  }
  .cb-sub {
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    font-size: 5.5px; letter-spacing: 0.16em; text-transform: uppercase;
    color: #6a5a35; font-weight: 600; margin-top: 2px;
  }
  .cb-pitch {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 8px; font-style: italic; color: #333; margin: 4px 0 5px;
    line-height: 1.2; max-width: 90%;
  }
  .cb-promo {
    border: 1px solid #c4b48a;
    border-radius: 4px;
    background: #fff;
    padding: 4px 8px 3px;
    margin-bottom: 4px;
    min-width: 72%;
  }
  .cb-promo-label {
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    font-size: 6px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: #6a5a35;
  }
  .cb-promo-code {
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    font-size: 13px; font-weight: 800; letter-spacing: 0.12em;
    color: #1a3a2e; margin: 1px 0;
  }
  .cb-promo-hint {
    font-size: 6px; color: #777; letter-spacing: 0.02em;
  }
  .cb-contact {
    font-family: 'Plus Jakarta Sans', Arial, sans-serif;
    font-size: 7px; font-weight: 600; color: #444; letter-spacing: 0.04em;
  }

  /* 3 — Care tips */
  .card-care { padding: 10px 7px 5px; display: flex; flex-direction: column; height: 100%; }
  .cc-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 11px; font-weight: 600; text-align: center; margin: 0 0 3px;
    color: #1a3a2e; letter-spacing: 0.04em;
  }
  .cc-list {
    margin: 0; padding: 0 0 0 12px; font-size: 7.5px; line-height: 1.32; color: #222;
  }
  .cc-list li { margin-bottom: 1.5px; }
  .cc-foot {
    margin-top: auto; text-align: center; font-size: 6.5px; color: #6a5a35;
    font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding-top: 2px;
  }

  /* 4 — Message — slightly larger type for readability */
  .card-message-cut {
    padding: 10px 8px 5px; display: flex; flex-direction: column; height: 100%;
    background: #fffdf8;
  }
  .cm-title {
    font-size: 7px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;
    color: #6a5a35; text-align: center; margin-bottom: 4px;
  }
  .cm-body {
    flex: 1; overflow: hidden;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 11.5px; line-height: 1.28; color: #1c1c1c;
    white-space: pre-wrap; word-break: break-word;
    text-align: center; font-style: italic;
    padding: 0 2px;
  }
  .cm-body.is-empty { color: #999; font-style: normal; font-size: 10px; }
  .cm-from {
    margin-top: 3px; text-align: center; font-size: 9px; font-weight: 700; color: #444;
  }
  .cm-brand {
    margin-top: auto; text-align: center; font-size: 6.5px; color: #8a7a55;
    letter-spacing: 0.1em; text-transform: uppercase; padding-top: 2px;
  }

  .no-print { margin-bottom: 10px; display: flex; gap: 10px; align-items: center; }
  .no-print button { padding: 8px 14px; font-weight: 700; cursor: pointer; }
  .no-print-hint { font-size: 12px; color: #555; }
  @page { size: A4 portrait; margin: 6mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; }
    .no-print { display: none !important; }
    .cut-card { page-break-inside: avoid; }
  }
`;

module.exports.LOGO_URL = `data:image/png;base64,${fs
  .readFileSync(path.join(__dirname, '../../assets/northblomst-logo-invoice.png'))
  .toString('base64')}`;

const floralPath = path.join(__dirname, '../../assets/card-floral.jpg');
module.exports.FLORAL_CARD_URL = fs.existsSync(floralPath)
  ? `data:image/jpeg;base64,${fs.readFileSync(floralPath).toString('base64')}`
  : '';
