const fs = require('fs');
const path = require('path');

/** Single-page production sheet — readable size, still fits A4 */
module.exports.PACKING_SLIP_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #1d1d1d; font-size: 11.5px; line-height: 1.28; background: #fff;
  }
  .page {
    width: 100%;
    max-width: 210mm;
    padding: 10px 12px;
    page-break-after: auto;
  }
  .header {
    display: grid; grid-template-columns: 120px 1fr 90px; align-items: center;
    gap: 8px; border-bottom: 2px solid #1c1c1c; padding-bottom: 7px; margin-bottom: 8px;
  }
  .logo { width: 110px; max-height: 42px; object-fit: contain; display: block; }
  .doc-title { text-align: center; }
  .doc-title h1 { margin: 0; font-size: 16px; letter-spacing: 1.4px; text-transform: uppercase; }
  .doc-title p { margin: 2px 0 0; font-size: 11px; color: #6a5a35; font-weight: 700; }
  .status-box { text-align: right; font-size: 10px; }
  .status-pill {
    display: inline-block; background: #111; color: #fff; padding: 3px 8px;
    border-radius: 99px; font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 3px;
  }
  .order-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 8px; }
  .mini {
    border: 1px solid #d2c7af; border-radius: 7px; padding: 6px 8px; background: #fffdf8;
  }
  .label {
    font-size: 9px; color: #7b6a43; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.35px; margin-bottom: 2px;
  }
  .value { font-size: 13.5px; font-weight: 900; color: #111; }
  .produce-box {
    border: 2px solid #111; border-radius: 8px; background: #fff8ea;
    padding: 8px; margin-bottom: 8px;
  }
  .produce-title {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px;
    font-weight: 900; color: #6a5a35; margin-bottom: 6px;
  }
  .produce-flex { display: flex; gap: 10px; align-items: flex-start; }
  .main-img {
    width: 96px; height: 96px; object-fit: cover; border-radius: 6px;
    border: 1px solid #d2c7af; flex-shrink: 0; display: block; background: #fff;
  }
  .main-img.no-img {
    display: flex; align-items: center; justify-content: center;
    background: #f6f2e9; color: #888; font-size: 10px; font-weight: 700;
  }
  .main-product-title { font-size: 16px; font-weight: 900; margin-bottom: 4px; line-height: 1.2; }
  .tag {
    display: inline-block; border: 1px solid #b89453; color: #5f4a1c; background: #fff;
    border-radius: 99px; padding: 2px 8px; font-size: 10px; font-weight: 900;
    margin-right: 4px; margin-top: 3px;
  }
  .grid-2 { display: grid; grid-template-columns: 1.15fr 0.95fr; gap: 7px; margin-bottom: 7px; }
  .box {
    border: 1px solid #d2c7af; border-radius: 7px; background: #fffdf8;
    padding: 7px 8px; margin-bottom: 7px;
  }
  .box-title {
    font-size: 9.5px; color: #6a5a35; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.45px; border-bottom: 1px solid #e3d9c5; padding-bottom: 3px; margin-bottom: 5px;
  }
  .name { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
  .line { margin-bottom: 1px; font-size: 11.5px; }
  .strong { font-weight: 900; }
  .muted { color: #777; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 9px; text-transform: uppercase; color: #6a5a35;
    border-bottom: 1.8px solid #111; padding: 4px 3px; font-weight: 900;
  }
  td { border-bottom: 1px solid #eadfca; padding: 5px 3px; vertical-align: top; font-size: 12px; }
  .product-name { font-weight: 800; font-size: 12.5px; }
  .small { font-size: 10.5px; color: #555; }
  .qty { width: 44px; text-align: center; font-weight: 900; font-size: 14px; }
  .info-row {
    display: grid; grid-template-columns: 130px 1fr; gap: 6px;
    padding: 3px 0; border-bottom: 1px dotted #e8dfcf;
  }
  .info-row:last-child { border-bottom: none; }
  .info-label { font-size: 9.5px; font-weight: 800; color: #6a5a35; text-transform: uppercase; }
  .info-value { font-size: 12px; font-weight: 700; color: #111; word-break: break-word; }
  .card-message {
    font-size: 13px; line-height: 1.4; white-space: pre-wrap;
    font-family: Georgia, "Times New Roman", serif; font-style: italic;
    border: 1px solid #e3d9c5; border-radius: 6px; background: #fff; padding: 8px;
  }
  .summary { width: 100%; }
  .summary td { padding: 3px 2px; border-bottom: 1px solid #eadfca; font-size: 11.5px; }
  .summary .s-label { font-weight: 800; }
  .summary .s-value { text-align: right; font-weight: 900; white-space: nowrap; }
  .summary .total td {
    border-top: 2px solid #111; border-bottom: none; padding-top: 6px;
    font-size: 13.5px; font-weight: 900;
  }
  .signature-area { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 6px; }
  .check {
    border: 1px solid #d2c7af; background: #fffdf8; border-radius: 5px;
    padding: 5px 6px; font-size: 10.5px; font-weight: 700;
  }
  .square {
    display: inline-block; width: 11px; height: 11px; border: 1.5px solid #111;
    margin-right: 4px; vertical-align: middle;
  }
  .footer {
    margin-top: 6px; border-top: 1px solid #e3d9c5; padding-top: 4px;
    display: flex; justify-content: space-between; color: #777; font-size: 9px;
  }
  .label-cut {
    margin: 8px 0 5px; border-top: 2px dashed #111; text-align: center; height: 10px;
  }
  .label-cut span {
    position: relative; top: -8px; background: #fff; padding: 0 8px;
    font-size: 9px; font-weight: 900; color: #333; letter-spacing: 0.4px;
    text-transform: uppercase;
  }
  .delivery-label {
    display: grid; grid-template-columns: 1.35fr 0.9fr;
    width: 100%; max-width: 170mm; margin: 0 auto;
    border: 1.8px dashed #111; border-radius: 4px;
    background: #fff; overflow: hidden;
    page-break-inside: avoid;
    min-height: 48mm;
  }
  .dl-left {
    display: flex; flex-direction: column; border-right: 1px solid #111;
    padding: 0;
  }
  .dl-recipient { padding: 7px 9px 6px; flex: 1; }
  .dl-name { font-size: 15px; font-weight: 900; margin-bottom: 3px; line-height: 1.15; }
  .dl-line { font-size: 11.5px; line-height: 1.3; }
  .dl-date { margin-top: 6px; font-size: 12px; font-weight: 800; }
  .dl-footer {
    border-top: 1px solid #111; padding: 5px 9px 6px; background: #fafafa;
  }
  .dl-partner { font-size: 11.5px; font-weight: 900; }
  .dl-line.muted { color: #444; font-size: 10px; }
  .dl-right {
    padding: 6px 8px; display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .dl-order { font-size: 13px; font-weight: 900; margin-bottom: 3px; letter-spacing: 0.2px; }
  .dl-flags { font-size: 10.5px; font-weight: 700; margin-bottom: 4px; line-height: 1.25; }
  .dl-qr-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .dl-qr-title { font-size: 10px; font-weight: 800; margin-bottom: 3px; }
  .dl-qr { width: 72px; height: 72px; display: block; }
  .dl-barcode {
    margin-top: 3px; font-size: 10px; font-weight: 800; letter-spacing: 0.3px;
    word-break: break-all; max-width: 100%;
  }
  .dl-logo {
    margin-top: 4px; width: 72px; max-height: 22px; object-fit: contain; opacity: 0.9;
  }
  .no-print { margin-bottom: 10px; display: flex; gap: 10px; align-items: center; }
  .no-print button { padding: 8px 14px; font-weight: 700; cursor: pointer; }
  .no-print-hint { font-size: 12px; color: #555; }
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 0; }
    .no-print { display: none !important; }
    .delivery-label { page-break-inside: avoid; }
  }
`;

module.exports.LOGO_URL = `data:image/png;base64,${fs
  .readFileSync(path.join(__dirname, '../../assets/northblomst-logo-invoice.png'))
  .toString('base64')}`;
