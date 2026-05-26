/**
 * Partner production sheet PDF (aligned with Shopify packing slip style).
 * Server-side generation with product images from order.products[].imageUrl.
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const axios = require('axios');

async function fetchImageBytes(imageUrl) {
  if (!imageUrl) return null;
  if (String(imageUrl).startsWith('data:')) {
    const m = String(imageUrl).match(/^data:[^;]+;base64,(.+)$/);
    if (m) return new Uint8Array(Buffer.from(m[1], 'base64'));
    return null;
  }
  try {
    const res = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 12000,
      headers: { Accept: 'image/*' }
    });
    if (res.status !== 200) return null;
    return new Uint8Array(res.data);
  } catch {
    return null;
  }
}

async function embedImage(pdfDoc, bytes) {
  if (!bytes) return null;
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

function wrapText(text, maxLen = 72) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return [s];
  const words = s.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxLen) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * @param {object} order - plain order object from Mongo
 * @returns {Promise<Uint8Array>} PDF bytes
 */
async function generateProductionSheetPdf(order) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  const draw = (text, size = 11, opts = {}) => {
    const { bold = false, indent = 0 } = opts;
    if (y < margin + 40) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
    page.drawText(String(text).slice(0, 200), {
      x: margin + indent,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0)
    });
    y -= size + 5;
  };

  const orderName = order.shopifyOrderName || order.shopifyOrderNumber || order.orderNumber || '';
  draw('NORTHBLOMST', 14, { bold: true });
  draw('northblomst.dk', 9);
  draw('PARTNER PRODUCTION SHEET', 12, { bold: true });
  draw(`ORDER ${orderName}`, 11, { bold: true });
  y -= 4;

  const delivery = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString('da-DK')
    : '';
  draw(`Levering: ${delivery || '—'}`, 10);
  if (order.totalPaidAmount != null) {
    draw(
      `Kunde betalte: ${Number(order.totalPaidAmount).toLocaleString('da-DK', { minimumFractionDigits: 2 })} ${order.currencyCode || 'DKK'}`,
      10
    );
  }
  draw(`Kunde: ${order.recipientName || order.customer?.name || ''}`, 10);
  draw(`Tlf: ${order.phone || order.customer?.phone || ''}`, 10);
  const addr = [
    order.address || order.shippingAddress?.address1,
    [order.postcode || order.shippingAddress?.postalCode, order.city || order.shippingAddress?.city]
      .filter(Boolean)
      .join(' ')
  ]
    .filter(Boolean)
    .join(', ');
  if (addr) draw(`Adresse: ${addr}`, 10);
  y -= 6;

  draw('PRODUKTER', 12, { bold: true });
  const products = order.products || [];
  const thumbSize = 48;
  const rowH = 56;

  for (const p of products) {
    if (y < margin + rowH + 20) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - margin;
    }
    const bytes = await fetchImageBytes(p.imageUrl);
    const img = await embedImage(pdfDoc, bytes);
    if (img) {
      const scale = Math.min(thumbSize / img.width, thumbSize / img.height);
      page.drawImage(img, {
        x: margin,
        y: y - thumbSize,
        width: img.width * scale,
        height: img.height * scale
      });
    } else {
      page.drawRectangle({
        x: margin,
        y: y - thumbSize,
        width: thumbSize,
        height: thumbSize,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.75, 0.75, 0.75),
        borderWidth: 0.5
      });
    }
    const lines = wrapText(`${p.quantity || 1} x ${p.name || 'Produkt'}`, 55);
    let ty = y - 12;
    for (const ln of lines.slice(0, 3)) {
      page.drawText(ln, {
        x: margin + thumbSize + 10,
        y: ty,
        size: 11,
        font,
        color: rgb(0, 0, 0)
      });
      ty -= 13;
    }
    y -= rowH;
  }

  const addOns = order.addOns || [];
  if (addOns.length > 0) {
    y -= 4;
    draw('TILVALG / ADD-ONS', 12, { bold: true });
    for (const a of addOns) {
      let line = `${a.label || ''}${a.value ? `: ${a.value}` : ''}`;
      if (a.quantity > 1) line += ` (${a.quantity} stk)`;
      for (const ln of wrapText(line, 80)) {
        draw(ln, 10, { indent: 4 });
      }
    }
  }

  const note =
    order.cardText || order.customer?.message || order.notes || '';
  if (note) {
    y -= 4;
    draw('BEMÆRKNINGER / KORTTEKST', 12, { bold: true });
    for (const ln of wrapText(note, 85)) {
      draw(ln, 10, { indent: 4 });
    }
  }

  return pdfDoc.save();
}

module.exports = { generateProductionSheetPdf };
