/** Northblomst partner production sheet – matches Shopify packing slip Liquid CSS */
module.exports.PACKING_SLIP_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #1d1d1d; font-size: 11.5px; line-height: 1.25; background: #fff;
  }
  .page { width: 100%; padding: 12px 14px; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page::before {
    content: "NORTHBLOMST"; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-size: 68px; font-weight: 800; letter-spacing: 5px;
    color: rgba(184, 148, 83, 0.045); z-index: -1; white-space: nowrap;
  }
  .top-border {
    height: 5px; background: linear-gradient(90deg, #1c1c1c, #b89453, #1c1c1c);
    border-radius: 99px; margin-bottom: 8px;
  }
  .header {
    display: grid; grid-template-columns: 145px 1fr 165px; align-items: center;
    gap: 10px; border-bottom: 1.5px solid #1c1c1c; padding-bottom: 8px; margin-bottom: 9px;
  }
  .logo { width: 118px; max-height: 62px; object-fit: contain; display: block; }
  .logo-site { margin-top: 2px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.4px; color: #333; }
  .doc-title { text-align: center; }
  .doc-title h1 { margin: 0; font-size: 17px; letter-spacing: 1.7px; text-transform: uppercase; }
  .doc-title p { margin: 2px 0 0; font-size: 10px; color: #6a5a35; font-weight: 700; text-transform: uppercase; }
  .status-box { text-align: right; font-size: 10px; }
  .status-pill {
    display: inline-block; background: #111; color: #fff; padding: 4px 8px;
    border-radius: 99px; font-size: 9.5px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.5px; margin-bottom: 4px;
  }
  .order-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 7px; }
  .mini { border: 1px solid #d2c7af; border-radius: 7px; padding: 6px 7px; background: #fffdf8; min-height: 44px; }
  .label { font-size: 9px; color: #7b6a43; text-transform: uppercase; font-weight: 900; letter-spacing: 0.35px; margin-bottom: 2px; }
  .value { font-size: 13px; font-weight: 900; color: #111; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 7px; }
  .box { border: 1px solid #d2c7af; border-radius: 8px; background: rgba(255, 253, 248, 0.88); padding: 7px; page-break-inside: avoid; }
  .box-title {
    font-size: 9.4px; color: #6a5a35; text-transform: uppercase; font-weight: 900;
    letter-spacing: 0.45px; border-bottom: 1px solid #e3d9c5; padding-bottom: 3px; margin-bottom: 5px;
  }
  .name { font-size: 13.5px; font-weight: 900; margin-bottom: 2px; color: #111; }
  .line { margin-bottom: 1px; }
  .strong { font-weight: 900; }
  .muted { color: #666; }
  .main-area { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 7px; }
  .main-image-card { border: 1px solid #d2c7af; border-radius: 8px; background: #fffdf8; padding: 6px; }
  .main-img { width: 100%; height: 128px; object-fit: cover; border-radius: 6px; border: 1px solid #e4dccb; display: block; }
  .no-img {
    width: 100%; height: 128px; border-radius: 6px; border: 1px solid #e4dccb; background: #f6f2e9;
    color: #777; display: flex; align-items: center; justify-content: center; text-align: center;
    padding: 8px; font-size: 10px;
  }
  .main-product-title { font-size: 14px; font-weight: 900; margin-bottom: 4px; }
  .tag {
    display: inline-block; border: 1px solid #b89453; color: #5f4a1c; background: #fff7e5;
    border-radius: 99px; padding: 2px 7px; font-size: 9.3px; font-weight: 900; margin-right: 4px; margin-top: 4px;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 9.2px; text-transform: uppercase; color: #6a5a35;
    border-bottom: 1.8px solid #111; padding: 4px 4px; font-weight: 900;
  }
  td { border-bottom: 1px solid #eadfca; padding: 5px 4px; vertical-align: top; }
  .thumb { width: 34px; height: 34px; object-fit: cover; border-radius: 4px; border: 1px solid #e4dccb; }
  .product-flex { display: flex; gap: 6px; align-items: flex-start; }
  .product-name { font-size: 12.2px; font-weight: 900; }
  .small { font-size: 10px; color: #444; }
  .qty { width: 42px; text-align: center; font-weight: 900; font-size: 13.5px; }
  .price { width: 82px; text-align: right; font-weight: 900; white-space: nowrap; }
  .totals { margin-top: 5px; display: grid; grid-template-columns: 1fr 190px; gap: 8px; }
  .summary td { padding: 3px 2px; border-bottom: 1px solid #eadfca; }
  .summary .s-label { font-size: 10px; font-weight: 800; }
  .summary .s-value { text-align: right; font-weight: 900; white-space: nowrap; }
  .signature-area { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 7px; }
  .check { border: 1px solid #d2c7af; background: #fffdf8; border-radius: 6px; padding: 5px; font-size: 10px; font-weight: 700; }
  .square { display: inline-block; width: 11px; height: 11px; border: 1.5px solid #111; margin-right: 4px; vertical-align: middle; }
  .cut { margin: 9px 0 5px; border-top: 2px dashed #111; text-align: center; height: 9px; }
  .cut span { position: relative; top: -8px; background: #fff; padding: 0 8px; font-size: 9px; font-weight: 900; color: #333; letter-spacing: 0.5px; }
  .tear { border: 1.5px dashed #111; border-radius: 8px; padding: 7px; background: #fffdf8; }
  .tear-grid { display: grid; grid-template-columns: 1.15fr 1.7fr 1.1fr; gap: 8px; }
  .tear-title { font-size: 9.2px; font-weight: 900; color: #6a5a35; text-transform: uppercase; margin-bottom: 3px; }
  .tear-big { font-size: 12.4px; font-weight: 900; }
  .terminal-note-box { border: 2.5px solid #111; background: #fff3c7; border-radius: 8px; padding: 8px; margin-bottom: 9px; }
  .terminal-note-title {
    background: #111; color: #fff; font-size: 13px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.6px; padding: 7px 9px; border-radius: 4px; margin-bottom: 8px;
  }
  .terminal-section { border: 1px solid #111; background: #fffdf4; border-radius: 6px; padding: 8px; margin-bottom: 8px; page-break-inside: avoid; }
  .terminal-section-title {
    font-size: 10.5px; text-transform: uppercase; font-weight: 900; color: #6a5a35;
    margin-bottom: 5px; border-bottom: 1px solid #d8c28d; padding-bottom: 3px;
  }
  .terminal-text { white-space: pre-line; font-size: 12.5px; line-height: 1.38; font-weight: 700; color: #111; }
  .terminal-text-large { white-space: pre-line; font-size: 13.5px; line-height: 1.4; font-weight: 800; color: #111; }
  .terminal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mini-card-cut {
    margin: 10px 0 6px;
    border-top: 2px dashed #111;
    text-align: center;
    height: 9px;
  }
  .mini-card-cut span {
    position: relative;
    top: -8px;
    background: #fff;
    padding: 0 8px;
    font-size: 9px;
    font-weight: 900;
    color: #333;
    letter-spacing: 0.5px;
  }
  .mini-card {
    width: 320px;
    max-width: 100%;
    border: 2px dashed #111;
    border-radius: 8px;
    padding: 10px;
    background: #fffdf8;
    page-break-inside: avoid;
  }
  .mini-card-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #6a5a35;
    font-weight: 900;
    margin-bottom: 6px;
  }
  .mini-card-message {
    min-height: 54px;
    border: 1px solid #e3d9c5;
    border-radius: 6px;
    background: #fff;
    padding: 8px;
    font-size: 14px;
    line-height: 1.35;
    white-space: pre-wrap;
    font-family: "Segoe Script", "Brush Script MT", cursive;
  }
  .mini-card-meta {
    margin-top: 6px;
    font-size: 10px;
    color: #555;
    font-weight: 700;
  }
  .footer {
    margin-top: 6px; border-top: 1px solid #e3d9c5; padding-top: 4px;
    display: flex; justify-content: space-between; color: #777; font-size: 9.2px;
  }
  .no-print { margin-bottom: 10px; }
  .no-print button { padding: 8px 14px; font-weight: 700; cursor: pointer; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 10px 12px; }
    .no-print { display: none !important; }
  }
`;

module.exports.LOGO_URL =
  'https://cdn.shopify.com/s/files/1/1000/9988/3340/files/ChatGPT_Image_May_13_2026_10_26_32_AM_6d7e7b69-8370-482f-8ba2-2810758cce46.png?v=1778699581';
