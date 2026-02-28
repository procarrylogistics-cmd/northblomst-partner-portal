import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

export async function generateOrderPdf(order) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { height } = page.getSize();

  const margin = 40;
  let y = height - margin;

  const drawText = (text, size = 12, options = {}) => {
    const { bold = false } = options;
    page.drawText(text, {
      x: margin,
      y,
      size,
      font,
      color: rgb(0, 0, 0)
    });
    y -= size + 4;
  };

  // Header
  drawText(`Ordre: ${order.shopifyOrderName || order.shopifyOrderNumber}`, 16);
  drawText(`Kunde: ${order.customer?.name || ''}`);
  drawText(`Telefon: ${order.customer?.phone || ''}`);
  drawText('');

  // Products
  drawText('Produktion:', 14);
  const thumbSize = 28;
  const rowHeight = 32;
  const leftIndent = margin + thumbSize + 8;
  for (const p of order.products || []) {
    if (p.imageUrl) {
      try {
        const imgRes = await fetch(p.imageUrl, { mode: 'cors' });
        if (imgRes.ok) {
          const arrBuf = await imgRes.arrayBuffer();
          const bytes = new Uint8Array(arrBuf);
          let img;
          try {
            img = await pdfDoc.embedPng(bytes);
          } catch {
            img = await pdfDoc.embedJpg(bytes);
          }
          const scale = Math.min(thumbSize / img.width, thumbSize / img.height);
          page.drawImage(img, {
            x: margin,
            y: y - thumbSize,
            width: img.width * scale,
            height: img.height * scale
          });
        }
      } catch (_) { /* skip thumbnail on fetch/embed error */ }
    }
    page.drawText(
      `${p.quantity} x ${p.name}${p.notes ? ` (${p.notes})` : ''}`,
      { x: leftIndent, y, size: 12, font, color: rgb(0, 0, 0) }
    );
    y -= rowHeight;
  }
  if ((order.products || []).length > 0) y -= 4;

  // Add-ons
  const addOns = order.addOns || [];
  if (addOns.length > 0) {
    drawText('');
    drawText('Tilvalg / Add-ons:', 14);
    addOns.slice(0, 6).forEach((a) => {
      let line = `${a.label}${a.value ? `: ${a.value}` : ''}`;
      if (a.quantity > 1) line += ` (${a.quantity} stk)`;
      if (a.price) line += ` · ${a.price} ${a.currency || 'DKK'}`;
      drawText(line, 11);
    });
    if (addOns.length > 6) {
      drawText(`... +${addOns.length - 6} flere`, 10);
    }
  }

  drawText('');
  if (order.totalPaidAmount != null && order.totalPaidAmount > 0) {
    const paidStr = `${order.totalPaidAmount.toLocaleString('da-DK', { minimumFractionDigits: 2 })} ${order.currencyCode || 'DKK'}`;
    drawText(`Kunde betalte: ${paidStr}`, 12);
    drawText('');
  }
  drawText('Korttekst / bemærkninger:', 14);
  drawText(order.customer?.message || 'Ingen besked', 12);

  // Bottom label area (1/4 page)
  const labelHeight = height * 0.25;
  const labelY = labelHeight + 20;

  page.drawLine({
    start: { x: margin, y: labelY + 10 },
    end: { x: 595.28 - margin, y: labelY + 10 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });

  const labelTextYStart = labelY;
  let ly = labelTextYStart;

  const drawLabelText = (text, size = 10) => {
    page.drawText(text, {
      x: margin,
      y: ly,
      size,
      font,
      color: rgb(0, 0, 0)
    });
    ly -= size + 2;
  };

  drawLabelText('Northblomst.dk');
  drawLabelText(
    `${order.shippingAddress?.address1 || ''}`
  );
  drawLabelText(
    `${order.shippingAddress?.postalCode || ''} ${order.shippingAddress?.city || ''}`
  );
  drawLabelText(`Tlf: ${order.customer?.phone || ''}`);

  const qrValue =
    order.trackingUrl ||
    `https://northblomst.dk/track/${order.shopifyOrderId || order._id}`;

  const qrDataUrl = await QRCode.toDataURL(qrValue, { margin: 1 });
  const qrImageBytes = Uint8Array.from(
    atob(qrDataUrl.split(',')[1]),
    (c) => c.charCodeAt(0)
  );
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  const qrSize = 90;

  page.drawImage(qrImage, {
    x: 595.28 - margin - qrSize,
    y: labelY - 10,
    width: qrSize,
    height: qrSize
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url);
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${order.shopifyOrderName || order.shopifyOrderNumber}.pdf`;
    a.click();
  }
}

