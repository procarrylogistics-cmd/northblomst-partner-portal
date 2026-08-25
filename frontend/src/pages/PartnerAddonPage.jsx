import React from 'react';
import { Link } from 'react-router-dom';
import PartnerManager from '../components/PartnerManager';

export default function PartnerAddonPage() {
  return (
    <div className="reports-page partner-addon-page">
      <div className="page-hero">
        <div className="page-hero-text">
          <p className="page-eyebrow">Administration</p>
          <h2>Partner addon</h2>
          <p className="page-lede">
            Florister, postnummer-zoner, CVR, bank og transport (69 DKK).
          </p>
        </div>
        <div className="header-actions">
          <Link to="/admin" className="btn-secondary">
            ← Tilbage til ordrer
          </Link>
        </div>
      </div>

      <div className="surface-card partner-addon-card">
        <PartnerManager />
      </div>
    </div>
  );
}
