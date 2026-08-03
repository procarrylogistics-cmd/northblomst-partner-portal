const fs = require('fs');
const path = require('path');

/** Cream-background logo — avoids black/transparent PNG printing as a black square */
function loadInvoiceLogoDataUri() {
  const logoPath = path.join(__dirname, '../../assets/northblomst-logo-invoice.png');
  const buf = fs.readFileSync(logoPath);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/** Northblomst / Procarry company details for settlement invoices */
module.exports = {
  COMPANY: {
    legalName: 'Northblomst (Procarry)',
    brandName: 'Northblomst',
    cvr: '41618019',
    address1: 'Gørdingvej 59',
    address2: '6771 Gredstedbro',
    country: 'Denmark',
    email: 'info@northblomst.dk',
    website: 'northblomst.dk',
    tagline: 'Deliver flowers with a smile · Deliver worldwide',
    logoUrl: loadInvoiceLogoDataUri()
  }
};
