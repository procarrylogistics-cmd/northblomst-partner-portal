import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'nb_announce_florist_note_v1';

export default function SystemUpdateAnnounce({ role }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (role !== 'partner' && role !== 'admin') return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch (_) {
      /* show anyway if storage blocked */
    }
    setOpen(true);
  }, [role]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}
    setOpen(false);
  };

  if (!open) return null;

  const isPartner = role === 'partner';

  return (
    <div className="modal-overlay system-announce-overlay" role="dialog" aria-modal="true" aria-labelledby="system-announce-title">
      <div className="modal-content system-announce" onClick={(e) => e.stopPropagation()}>
        <div className="system-announce-badge">Systemopdatering</div>
        <h3 id="system-announce-title">
          {isPartner ? 'Nyhed: Note til florist' : 'Update til partnerne'}
        </h3>
        {isPartner ? (
          <>
            <p>
              Portalen er opdateret. Du kan nu se <strong>Note til florist</strong> tydeligt
              under <strong>Korttekst</strong> på hver ordre — i den orange boks.
            </p>
            <p>
              Der har været nogle små justeringer undervejs. Nu er alt klar, så du ikke går glip
              af vigtige instruktioner fra os.
            </p>
          </>
        ) : (
          <>
            <p>
              Partnere kan nu se <strong>Note til florist</strong> (Shopify «Notes to florist»)
              tydeligt under Korttekst i den orange boks — samme sted som dig.
            </p>
            <p>
              Små justeringer er på plads. Fortæl gerne partnerne, at de skal kigge efter den
              orange note på ordren.
            </p>
          </>
        )}
        <div className="modal-actions system-announce-actions">
          <button type="button" className="primary" onClick={dismiss}>
            Forstået
          </button>
        </div>
      </div>
    </div>
  );
}
