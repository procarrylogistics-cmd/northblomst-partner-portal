import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

export default function CreateOrderModal({ isAdmin, onClose, onCreated }) {
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState({
    recipientName: '',
    address: '',
    postcode: '',
    city: '',
    phone: '',
    deliveryDate: new Date().toISOString().slice(0, 10),
    cardFlag: false,
    cardText: '',
    notes: '',
    productSummary: '',
    partnerId: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      axios.get(`${API_BASE}/partners`).then((res) => setPartners(res.data || []));
    }
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        recipientName: form.recipientName.trim(),
        address: form.address.trim(),
        postcode: form.postcode.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        deliveryDate: form.deliveryDate,
        cardFlag: form.cardFlag,
        cardText: form.cardFlag ? form.cardText.trim() : '',
        notes: form.notes.trim(),
        productSummary: form.productSummary.trim()
      };
      if (isAdmin && form.partnerId) payload.partnerId = form.partnerId;
      const res = await axios.post(`${API_BASE}/orders/manual`, payload);
      onCreated(res.data);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      const fallback = `Fejl ${status || ''}: ${err.response?.statusText || 'Kunne ikke oprette ordre'}`;
      if (status === 401) setError('Ikke logget ind');
      else if (status === 403) setError(msg || 'Ingen adgang (rolle)');
      else setError(msg || fallback);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Opret ordre</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Luk">
            ×
          </button>
        </div>
        {error && <div className="error modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="create-order-form">
          <label>
            Modtager <span className="required">*</span>
            <input
              value={form.recipientName}
              onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              required
              placeholder="Navn"
            />
          </label>
          <label>
            Adresse <span className="required">*</span>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
              placeholder="Vejnavn og nr."
            />
          </label>
          <div className="form-row">
            <label>
              Postnummer <span className="required">*</span>
              <input
                value={form.postcode}
                onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                required
                placeholder="1234"
              />
            </label>
            <label>
              By <span className="required">*</span>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
                placeholder="København"
              />
            </label>
          </div>
          <label>
            Telefon <span className="required">*</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              placeholder="+45 12 34 56 78"
            />
          </label>
          <label>
            Leveringsdato <span className="required">*</span>
            <input
              type="date"
              value={form.deliveryDate}
              onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
              required
            />
          </label>
          {isAdmin && (
            <label>
              Partner (valgfri)
              <select
                value={form.partnerId}
                onChange={(e) => setForm({ ...form, partnerId: e.target.value })}
              >
                <option value="">Ikke tildelt</option>
                {partners.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.cardFlag}
              onChange={(e) => setForm({ ...form, cardFlag: e.target.checked })}
            />
            Kort medfølger
          </label>
          {form.cardFlag && (
            <label>
              Korttekst
              <textarea
                value={form.cardText}
                onChange={(e) => setForm({ ...form, cardText: e.target.value })}
                placeholder="Tekst til kortet"
                rows={3}
              />
            </label>
          )}
          <label>
            Bemærkninger
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Valgfri bemærkninger"
            />
          </label>
          <label>
            Produktoversigt
            <textarea
              value={form.productSummary}
              onChange={(e) => setForm({ ...form, productSummary: e.target.value })}
              placeholder="F.eks. 12 røde roser, buket"
              rows={2}
            />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Annuller
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Opretter…' : 'Opret ordre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
