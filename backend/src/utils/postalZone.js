const fs = require('fs');
const path = require('path');

const zonesPath = path.join(__dirname, '..', 'config', 'zones.json');

let zonesConfig = {};
try {
  // Lazy load JSON as simple configurable map
  // Example: { "1000-2999": "CPH", "5000-5999": "Fyn", "4600": "Koge" }
  zonesConfig = JSON.parse(fs.readFileSync(zonesPath, 'utf8'));
} catch (err) {
  console.warn('zones.json not found or invalid, using empty zones config');
}

function matchZoneForPostalCode(postalCodeRaw) {
  if (!postalCodeRaw) return null;
  const postalCode = String(postalCodeRaw).trim();
  const numeric = parseInt(postalCode, 10);
  if (Number.isNaN(numeric)) return null;

  for (const [key, zone] of Object.entries(zonesConfig)) {
    if (key.includes('-')) {
      const [startStr, endStr] = key.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!Number.isNaN(start) && !Number.isNaN(end) && numeric >= start && numeric <= end) {
        return zone;
      }
    } else {
      const exact = parseInt(key, 10);
      if (!Number.isNaN(exact) && numeric === exact) {
        return zone;
      }
    }
  }
  return null;
}

module.exports = {
  matchZoneForPostalCode,
  zonesConfig
};

