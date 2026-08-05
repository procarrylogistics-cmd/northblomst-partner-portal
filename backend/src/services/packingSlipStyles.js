const fs = require('fs');
const path = require('path');

/** Compact single-page partner production sheet */
module.exports.PACKING_SLIP_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #1d1d1d; font-size: 10.5px; line-height: 1.2; background: #fff;
  }
  .page {
    width: 100%;
    max-width: 210mm;
    min-height: auto;
    padding: 8px 10px;
    position: relative;
    page-break-after: auto;
    page-break-inside: avoid;
  }
  .header {
    display: grid; grid-template-columns: 100px 1fr 70px; align-items: center;
    gap: 6px; border-bottom: 1.5px solid #1c1c1c; padding-bottom: 5px; margin-bottom: 6px;
  }
  .logo { width: 92px; max-height: 34px; object-fit: contain; display: block; }
  .doc-title { text-align: center; }
  .doc-title h1 { margin: 0; font-size: 14px; letter-spacing: 1.2px; text-transform: uppercase; }
  .doc-title p { margin: 1px 0 0; font-size: 9.5px; color: #555; font-weight: 700; }
  .status-box { text-align: right; }
  .status-pill {
    display: inline-block; background: #111; color: #fff; padding: 2px 7px;
    border-radius: 99px; font-size: 8.5px; font-weight: 800; text-transform: uppercase;
  }
  .order-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 5px; margin-bottom: 6px; }
  .mini {
    border: 1px solid #d2c7af; border-radius: 5px; padding: 4px 6px;
    background: #fffdf8; min-height: 0;
  }
  .label {
    font-size: 8px; color: #7b6a43; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.3px; margin-bottom: 1px;
  }
  .value { font-size: 12px; font-weight: 900; color: #111; }
  .grid-main { display: grid; grid-template-columns: 1.1fr 1fr; gap: 5px; margin-bottom: 5px; }
  .box {
    border: 1px solid #d2c7af; border-radius: 6px; background: #fffdf8;
    padding: 5px 6px; margin-bottom: 5px;
  }
  .box-title {
    font-size: 8.5px; color: #6a5a35; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.4px; border-bottom: 1px solid #e3d9c5; padding-bottom: 2px; margin-bottom: 4px;
  }
  .name { font-size: 12px; font-weight: 900; margin-bottom: 1px; }
  .line { margin-bottom: 0; font-size: 10px; }
  .strong { font-weight: 900; }
  .muted { color: #777; }
  .main-flex { display: flex; gap: 6px; align-items: flex-start; }
  .main-thumb {
    width: 52px; height: 52px; object-fit: cover; border-radius: 4px;
    border: 1px solid #e4dccb; flex-shrink: 0; display: block;
  }
  .main-thumb.no-img, .no-img {
    width: 52px; height: 52px; border-radius: 4px; border: 1px solid #e4dccb;
    background: #f6f2e9; color: #999; display: flex; align-items: center; justify-content: center;
    font-size: 9px;
  }
  .main-product-title { font-size: 11.5px; font-weight: 900; margin-bottom: 2px; }
  .tag {
    display: inline-block; border: 1px solid #b89453; color: #5f4a1c; background: #fff7e5;
    border-radius: 99px; padding: 1px 6px; font-size: 8.5px; font-weight: 900; margin-top: 2px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 8px; text-transform: uppercase; color: #6a5a35;
    border-bottom: 1.5px solid #111; padding: 2px 3px; font-weight: 900;
  }
  td { border-bottom: 1px solid #eadfca; padding: 3px; vertical-align: top; font-size: 10px; }
  .product-name { font-weight: 800; font-size: 10.5px; }
  .small { font-size: 9px; color: #555; }
  .qty { width: 36px; text-align: center; font-weight: 900; font-size: 11px; }
  .info-box { max-height: none; }
  .info-row {
    display: grid; grid-template-columns: 110px 1fr; gap: 4px;
    padding: 2px 0; border-bottom: 1px dotted #e8dfcf;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { font-size: 8.5px; font-weight: 800; color: #6a5a35; text-transform: uppercase; }
  .info-value { font-size: 10px; font-weight: 700; color: #111; word-break: break-word; }
  .card-box .card-message {
    font-size: 11px; line-height: 1.3; white-space: pre-wrap;
    font-family: Georgia, "Times New Roman", serif; font-style: italic;
    max-height: 3.6em; overflow: hidden;
  }
  .finance-bar {
    display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center;
    border: 1px solid #111; border-radius: 5px; padding: 5px 8px;
    background: #fff8ea; margin: 5px 0; font-size: 10px; font-weight: 800;
  }
  .finance-total { margin-left: auto; font-size: 12px; }
  .signature-area { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 4px; }
  .check {
    border: 1px solid #d2c7af; background: #fffdf8; border-radius: 4px;
    padding: 3px 5px; font-size: 9px; font-weight: 700;
  }
  .square {
    display: inline-block; width: 9px; height: 9px; border: 1.4px solid #111;
    margin-right: 3px; vertical-align: middle;
  }
  .footer {
    margin-top: 4px; border-top: 1px solid #e3d9c5; padding-top: 3px;
    display: flex; justify-content: space-between; color: #777; font-size: 8px;
  }
  .no-print { margin-bottom: 8px; display: flex; gap: 10px; align-items: center; }
  .no-print button { padding: 8px 14px; font-weight: 700; cursor: pointer; }
  .no-print-hint { font-size: 12px; color: #555; }
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; max-height: none; }
    .no-print { display: none !important; }
    .box, .mini, .finance-bar, .check, tr { page-break-inside: avoid; }
  }
`;

/** Cream-flattened logo — transparent/black PNG prints as a solid black square in many browsers */
module.exports.LOGO_URL = `data:image/png;base64,${fs
  .readFileSync(path.join(__dirname, '../../assets/northblomst-logo-invoice.png'))
  .toString('base64')}`;
