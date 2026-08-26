import React from 'react';

const OFFICE_EMAIL = 'office@northblomst.dk';
const OFFICE_PHONE = '42 83 33 16';

/**
 * Professional notice for suspended partners — reports-only access.
 */
export default function SuspendedAccessBanner({ compact = false }) {
  return (
    <aside className={`suspended-banner${compact ? ' is-compact' : ''}`} role="status">
      <div className="suspended-banner-accent" aria-hidden="true" />
      <div className="suspended-banner-body">
        <p className="suspended-banner-eyebrow">Konto status</p>
        <h2 className="suspended-banner-title">Adgang midlertidigt begrænset</h2>
        <p className="suspended-banner-text">
          Din partnerkonto er sat til <strong>Suspended</strong>. Du har kun adgang til{' '}
          <strong>Reports</strong> til egen kontrol af afregning — ikke til ordrer, produktion
          eller øvrige systemfunktioner.
        </p>
        <p className="suspended-banner-text">
          Har du spørgsmål, eller ønsker du at genåbne adgangen, kontakt venligst{' '}
          <strong>Office Northblomst</strong>.
        </p>
        <div className="suspended-banner-contact">
          <a href={`mailto:${OFFICE_EMAIL}`}>{OFFICE_EMAIL}</a>
          <span className="suspended-banner-sep" aria-hidden="true">
            ·
          </span>
          <a href={`tel:+45${OFFICE_PHONE.replace(/\s/g, '')}`}>{OFFICE_PHONE}</a>
        </div>
      </div>
    </aside>
  );
}
