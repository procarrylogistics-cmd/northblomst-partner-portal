import React, { useMemo, useState } from 'react';
import { CARD_MESSAGE_CHAR_LIMIT } from '../utils/cardMessage';
import {
  FUNERAL_CARD_CHAR_LIMIT,
  CARD_VARIANTS,
  printManualCard
} from '../utils/printCardText';

/**
 * Admin tool: type a card message, pick normal / funeral, print.
 */
export default function ManualCardPrintModal({ open, onClose }) {
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [variant, setVariant] = useState(CARD_VARIANTS.normal);

  const limit = variant === CARD_VARIANTS.funeral ? FUNERAL_CARD_CHAR_LIMIT : CARD_MESSAGE_CHAR_LIMIT;
  const remaining = limit - message.length;

  const hint = useMemo(() => {
    if (variant === CARD_VARIANTS.funeral) {
      return 'Begravelseskort: A4 stående, fold øverste halvdel ned — sort forside med kors, hilsen indeni.';
    }
    return 'Normalt kort: lille udskæringskort med logo og korttekst.';
  }, [variant]);

  if (!open) return null;

  const handlePrint = () => {
    const text = message.trim();
    if (!text) {
      alert('Skriv en korttekst først.');
      return;
    }
    printManualCard({ message: text.slice(0, limit), variant, senderName: senderName.trim() });
  };

  const onVariantChange = (next) => {
    setVariant(next);
    const nextLimit = next === CARD_VARIANTS.funeral ? FUNERAL_CARD_CHAR_LIMIT : CARD_MESSAGE_CHAR_LIMIT;
    setMessage((prev) => (prev.length > nextLimit ? prev.slice(0, nextLimit) : prev));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content manual-card-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Print kort manuelt</h3>
        <p className="form-hint">{hint}</p>

        <div className="manual-card-variant">
          <label className={variant === CARD_VARIANTS.normal ? 'is-active' : ''}>
            <input
              type="radio"
              name="cardVariant"
              checked={variant === CARD_VARIANTS.normal}
              onChange={() => onVariantChange(CARD_VARIANTS.normal)}
            />
            Normalt kort
          </label>
          <label className={variant === CARD_VARIANTS.funeral ? 'is-active' : ''}>
            <input
              type="radio"
              name="cardVariant"
              checked={variant === CARD_VARIANTS.funeral}
              onChange={() => onVariantChange(CARD_VARIANTS.funeral)}
            />
            Begravelseskort
          </label>
        </div>

        <label>
          Korttekst
          <textarea
            rows={8}
            value={message}
            maxLength={limit}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              variant === CARD_VARIANTS.funeral
                ? 'F.eks. I kærlig erindring af …\nVi sender vores dybeste medfølelse.'
                : 'Skriv kortteksten her…'
            }
          />
        </label>
        <p className={`form-hint ${remaining < 40 ? 'warn' : ''}`}>
          {message.length} / {limit} tegn
        </p>

        <label>
          Afsender (valgfri)
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Navn der skal stå under teksten"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Luk
          </button>
          <button type="button" className="btn-primary" onClick={handlePrint}>
            Print kort
          </button>
        </div>
      </div>
    </div>
  );
}
