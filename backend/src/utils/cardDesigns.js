/**
 * Letter-card (besked) design catalog for duplex verso printing.
 * Designs are sold add-ons style — partner/admin picks before Print verso.
 */

const fs = require('fs');
const path = require('path');
const { LOGO_URL, FLORAL_CARD_URL } = require('../services/packingSlipStyles');

const DESIGNS = [
  {
    id: 'standard',
    label: 'Standard kort',
    priceKr: 20,
    description: 'Klassisk logo-bagside'
  },
  {
    id: 'floral',
    label: 'Blomster',
    priceKr: 30,
    description: 'Mørk floral bagside'
  },
  {
    id: 'blue_boy',
    label: 'Blå — dreng',
    priceKr: 30,
    description: 'Blød blå bagside'
  },
  {
    id: 'classic',
    label: 'Klassisk hvid',
    priceKr: 25,
    description: 'Hvid med ramme og logo'
  },
  {
    id: 'custom',
    label: 'Eget billede',
    priceKr: 35,
    description: 'Upload via URL (kunde-foto)'
  }
];

function listCardDesigns() {
  return DESIGNS.map(({ id, label, priceKr, description }) => ({
    id,
    label,
    priceKr,
    description
  }));
}

function normalizeDesignId(value) {
  const id = String(value || '')
    .trim()
    .toLowerCase();
  if (DESIGNS.some((d) => d.id === id)) return id;
  return 'standard';
}

function resolveMessageCardBackHtml(mongo, esc) {
  const designId = normalizeDesignId(mongo?.messageCardDesign);
  const customUrl = String(mongo?.cardBackImageUrl || '').trim();
  const hasCustom =
    designId === 'custom' && (/^https?:\/\//i.test(customUrl) || customUrl.startsWith('data:'));

  if (designId === 'floral' && FLORAL_CARD_URL) {
    return `
    <div class="cut-card card-back card-back-floral">
      <span class="card-back-tag">4 · Besked</span>
      <img class="card-back-img is-photo" src="${esc(FLORAL_CARD_URL)}" alt="Floral kort" />
      <div class="card-back-mark">Northblomst</div>
    </div>`;
  }

  if (designId === 'blue_boy') {
    return `
    <div class="cut-card card-back card-back-blue-boy">
      <span class="card-back-tag">4 · Besked</span>
      <div class="blue-boy-inner">
        <div class="blue-boy-badge">Til dig</div>
        <div class="blue-boy-title">Northblomst</div>
        <div class="blue-boy-sub">Flowers with a smile</div>
        <img class="blue-boy-logo" src="${esc(LOGO_URL)}" alt="" />
      </div>
    </div>`;
  }

  if (designId === 'classic') {
    return `
    <div class="cut-card card-back card-back-classic">
      <span class="card-back-tag">4 · Besked</span>
      <div class="classic-frame">
        <img class="classic-logo" src="${esc(LOGO_URL)}" alt="Northblomst" />
        <div class="classic-script">Northblomst</div>
      </div>
    </div>`;
  }

  if (hasCustom) {
    return `
    <div class="cut-card card-back">
      <span class="card-back-tag">4 · Besked</span>
      <img class="card-back-img is-photo" src="${esc(customUrl)}" alt="Kundebillede" />
      <div class="card-back-mark">Northblomst</div>
    </div>`;
  }

  // standard (+ fallbacks)
  return `
  <div class="cut-card card-back">
    <span class="card-back-tag">4 · Besked</span>
    <img class="card-back-img" src="${esc(LOGO_URL)}" alt="Northblomst" />
    <div class="card-back-mark">Northblomst</div>
  </div>`;
}

function resolveLogoBackHtml(label, esc) {
  return `
  <div class="cut-card card-back">
    <span class="card-back-tag">${esc(label)}</span>
    <img class="card-back-img" src="${esc(LOGO_URL)}" alt="Northblomst" />
    <div class="card-back-mark">Northblomst</div>
  </div>`;
}

module.exports = {
  DESIGNS,
  listCardDesigns,
  normalizeDesignId,
  resolveMessageCardBackHtml,
  resolveLogoBackHtml
};
