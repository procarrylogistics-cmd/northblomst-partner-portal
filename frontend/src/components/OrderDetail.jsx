import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { generateOrderPdf } from '../utils/pdf';
import EditOrderModal from './EditOrderModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

export default function OrderDetail({ order, onUpdated, isAdmin = false }) {
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl || '');
  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [statusError, setStatusError] = useState('');

  const currentPartnerId = order.partner?._id ?? order.partner ?? null;
  const currentPartnerIdStr = currentPartnerId ? String(currentPartnerId) : '';

  useEffect(() => {
    setTrackingNumber(order.trackingNumber || '');
    setTrackingUrl(order.trackingUrl || '');
    setSelectedPartnerId(currentPartnerIdStr);
  }, [order._id, order.trackingNumber, order.trackingUrl, currentPartnerIdStr]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    axios.get(`${API_BASE}/partners`).then((res) => {
      if (!cancelled) setPartners(res.data);
    });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const updateStatus = async (status) => {
    setUpdating(true);
    setStatusError('');
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/status`, { status });
      await onUpdated();
    } catch (err) {
      console.error(err);
      setStatusError(err.response?.data?.message || 'Kunne ikke opdatere status');
    } finally {
      setUpdating(false);
    }
  };

  const saveTracking = async () => {
    setUpdating(true);
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/tracking`, {
        trackingNumber,
        trackingUrl
      });
      await onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = async () => {
    await generateOrderPdf(order);
  };

  const handleAssign = async () => {
    if (!selectedPartnerId) return;
    setAssigning(true);
    setAssignMessage('');
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/assign`, {
        partnerId: selectedPartnerId
      });
      setAssignMessage('Tildelt!');
      await onUpdated();
      setTimeout(() => setAssignMessage(''), 3000);
    } catch (err) {
      setAssignMessage(err.response?.data?.message || 'Kunne ikke tildele');
    } finally {
      setAssigning(false);
    }
  };

  const handleCancel = async () => {
    setUpdating(true);
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/cancel`, { reason: cancelReason });
      setShowCancelConfirm(false);
      setCancelReason('');
      await onUpdated();
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Kunne ikke annullere');
    } finally {
      setUpdating(false);
    }
  };

  const isCancelled = order.status === 'cancelled';

  const receivedAt = order.receivedAt || order.createdAt;
  const receivedStr = receivedAt
    ? new Date(receivedAt).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' }) + ' ' +
      new Date(receivedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    : '';
  const deliveryStr = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })
    : '';

  return (
    <div className="order-detail">
      <h3>{order.orderNumber || order.shopifyOrderName || order.shopifyOrderNumber}</h3>
      <div className="order-badges">
        {order.createdByRole === 'partner' && <span className="badge badge-created">Oprettet af partner</span>}
        {order.createdByRole === 'admin' && <span className="badge badge-created">Oprettet af admin</span>}
        {(order.updateCount || 0) > 0 && (
          <span className="badge badge-updated" title={order.updatedAt ? `Sidst opdateret: ${new Date(order.updatedAt).toLocaleString('da-DK')}${order.updatedByEmail ? ` af ${order.updatedByEmail}` : ''}` : ''}>
            Opdateret{order.updatedAt ? ` ${new Date(order.updatedAt).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })} ${new Date(order.updatedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        )}
        {isCancelled && <span className="badge badge-cancelled">Annulleret</span>}
      </div>
      {(receivedStr || deliveryStr) && (
        <p className="order-timestamps">
          {receivedStr && <span><strong>Modtaget:</strong> {receivedStr}</span>}
          {receivedStr && deliveryStr && ' · '}
          {deliveryStr && <span><strong>Levering:</strong> {deliveryStr}</span>}
        </p>
      )}
      <p className="order-customer">
        <strong>Kunde:</strong> {order.recipientName || order.customer?.name} ({order.phone || order.customer?.phone})
      </p>
      <p>
        <strong>Leveringsadresse:</strong><br />
        {order.address || order.shippingAddress?.address1}<br />
        {order.postcode || order.shippingAddress?.postalCode} {order.city || order.shippingAddress?.city}
      </p>
      <div>
        <strong>Produkter:</strong>
        {order.productSummary ? (
          <p>{order.productSummary}</p>
        ) : (
          <ul>
            {order.products?.map((p, idx) => (
              <li key={idx}>
                {p.quantity} x {p.name} {p.notes && <em>({p.notes})</em>}
              </li>
            ))}
            {(!order.products || order.products.length === 0) && <li>Ingen produkter</li>}
          </ul>
        )}
      </div>

      <div className="order-addons">
        <strong>Tilvalg / Add-ons</strong>
        {order.addOns && order.addOns.length > 0 ? (
          <ul>
            {order.addOns.map((a, idx) => (
              <li key={idx}>
                <strong>{a.label}</strong>
                {a.value && `: ${a.value}`}
                {a.quantity > 1 && ` (${a.quantity} stk)`}
                {a.price && ` · ${a.quantity > 1 ? `${a.quantity} × ` : ''}${a.price} ${a.currency || 'DKK'}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>Ingen tilvalg</p>
        )}
      </div>

      <p>
        <strong>Korttekst / bemærkninger:</strong><br />
        {order.cardText || order.customer?.message || order.notes || 'Ingen besked'}
      </p>

      <div className="order-actions">
        {!isCancelled && (
          <>
            <div className="status-buttons">
              <button disabled={updating} onClick={() => updateStatus('new')}>Ny</button>
              <button disabled={updating} onClick={() => updateStatus('in_production')}>I produktion</button>
              <button disabled={updating} onClick={() => updateStatus('ready')}>Klar til levering</button>
              <button disabled={updating} onClick={() => updateStatus('fulfilled')}>Leveret</button>
            </div>
            <button type="button" onClick={() => setShowEdit(true)} disabled={updating}>Rediger</button>
            <button type="button" className="btn-cancel" onClick={() => setShowCancelConfirm(true)} disabled={updating}>
              Annuller ordre
            </button>
          </>
        )}
        {statusError && <div className="error">{statusError}</div>}
        <button className="primary" onClick={handlePrint} disabled={isCancelled}>
          Print ordreseddel
        </button>
      </div>
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Annuller ordre?</h3>
            <label>
              Årsag (valgfri)
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="F.eks. Kunde aflyste" />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCancelConfirm(false)}>Fortryd</button>
              <button type="button" className="btn-cancel" onClick={handleCancel} disabled={updating}>
                {updating ? 'Annullerer…' : 'Ja, annuller'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEdit && (
        <EditOrderModal
          order={order}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setShowEdit(false);
            onUpdated();
          }}
        />
      )}

      <div className="tracking">
        <h4>Tracking</h4>
        <label>
          Trackingnummer
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
        </label>
        <label>
          Tracking URL
          <input
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
          />
        </label>
        <button onClick={saveTracking} disabled={updating}>
          Gem tracking
        </button>
      </div>

      {isAdmin && (
        <div className="order-assign">
          <h4>Tildel partner</h4>
          {order.partner && (
            <p className="current-partner">
              Nuværende: <strong>{order.partner?.name}</strong>
              {order.partner?.email && ` (${order.partner.email})`}
            </p>
          )}
          <div className="assign-row">
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="assign-select"
              aria-label="Vælg partner"
            >
              <option value="">Vælg partner</option>
              {partners.map((p) => (
                <option key={p._id} value={String(p._id)}>
                  {p.name} {p.zoneRanges?.length ? `(${p.zoneRanges.join(', ')})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssign}
              disabled={assigning || !selectedPartnerId}
              className="assign-btn"
            >
              {assigning ? 'Tildeler…' : 'Tildel valgt partner'}
            </button>
          </div>
          {assignMessage && (
            <div className={`assign-toast ${assignMessage === 'Tildelt!' ? 'success' : 'error'}`}>
              {assignMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

