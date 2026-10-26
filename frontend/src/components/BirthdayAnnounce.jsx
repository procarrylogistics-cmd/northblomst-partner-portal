import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'nb_announce_marian_bday_2026';

export default function BirthdayAnnounce() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch (_) {
      /* show anyway */
    }
    setOpen(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay birthday-announce-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="birthday-announce-title"
    >
      <div className="modal-content birthday-announce" onClick={(e) => e.stopPropagation()}>
        <div className="birthday-stars" aria-hidden="true">
          <span>✦</span>
          <span>★</span>
          <span>✧</span>
          <span>★</span>
          <span>✦</span>
        </div>
        <div className="birthday-announce-badge">I dag</div>
        <h3 id="birthday-announce-title">Happy Birthday, Marian!</h3>
        <p className="birthday-announce-lead">
          ★ ★ ★ Stort tillykke med fødselsdagen ★ ★ ★
        </p>
        <p>
          Hele Northblomst-holdet ønsker dig en fantastisk dag — tak for alt du kører og
          sørger for. Du er guld!
        </p>
        <div className="birthday-stars birthday-stars-bottom" aria-hidden="true">
          <span>★</span>
          <span>✦</span>
          <span>★</span>
          <span>✧</span>
          <span>★</span>
        </div>
        <div className="modal-actions system-announce-actions">
          <button type="button" className="primary" onClick={dismiss}>
            Tak! 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
