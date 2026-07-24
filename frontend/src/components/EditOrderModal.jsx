import React, { useState } from 'react';
import axios from 'axios';
import { toDateInputValue } from '../utils/dateInput';
import { extractCardMessage } from '../utils/cardMessage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

const editableFields = ['recipientName', 'address', 'postcode', 'city', 'phone', 'deliveryDate', 'cardFlag', 'cardText', 'notes', 'productSummary'];

export default function EditOrderModal({ order, onClose, onSaved }) {
  const deliveryDateVal = toDateInputValue(order.deliveryDate) || toDateInputValue(new Date());
  const initialCardText = extractCardMessage(order);
  const [form, setForm] = useState({
    recipientName: order.recipientName || order.customer?.name || '',
    address: order.address || order.shippingAddress?.address1 || '',
    postcode: order.postcode || order.shippingAddress?.postalCode || '',
    city: order.city || order.shippingAddress?.city || '',
    phone: order.phone || order.customer?.phone || '',
    deliveryDate: deliveryDateVal,
    cardFlag: !!order.cardFlag || !!initialCardText,
    cardText: initialCardText,
    notes: order.notes || '',
    productSummary: order.productSummary || ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {};
      editableFields.forEach((f) => {
        if (f === 'deliveryDate') payload[f] = form[f];
        else if (f === 'cardFlag') payload[f] = !!form.cardText?.trim();
        else if (f === 'cardText') payload[f] = form.cardText ?? '';
        else payload[f] = form[f]?.trim?.() ?? form[f];
      });
      const res = await axios.patch(`${API_BASE}/orders/${order._id}`, payload);
      onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Kunne ikke gemme');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Rediger ordre</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Luk">×</button>
        </div>
        {error && <div className="error modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="create-order-form">
          <label>Modtager <span className="required">*</span>
            <input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
          </label>
          <label>Adresse <span className="required">*</span>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          </label>
          <div className="form-row">
            <label>Postnummer <span className="required">*</span>
              <input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} required />
            </label>
            <label>By <span className="required">*</span>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
            </label>
          </div>
          <label>Telefon <span className="required">*</span>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </label>
          <label>Leveringsdato <span className="required">*</span>
            <input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} required />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.cardFlag}
              onChange={(e) => {
                const checked = e.target.checked;
                setForm({
                  ...form,
                  cardFlag: checked,
                  cardText: checked ? form.cardText : ''
                });
              }}
            />
            Kort medfølger
          </label>
          <label>Korttekst
            <textarea
              value={form.cardText}
              onChange={(e) => setForm({
                ...form,
                cardText: e.target.value,
                cardFlag: !!e.target.value.trim()
              })}
              rows={5}
              placeholder="Skriv korttekst her. Tom = ingen korttekst."
            />
          </label>
          <p className="form-hint">Hvis du sletter korttekst her, fjernes den også fra tilvalg / print.</p>
          <label>Bemærkninger (florist / intern)
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Ikke vist som korttekst"
            />
          </label>
          <label>Produktoversigt
            <textarea value={form.productSummary} onChange={(e) => setForm({ ...form, productSummary: e.target.value })} rows={2} />
          </label>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Annuller</button>
            <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Gemmer…' : 'Gem'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
