import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [partnerId, setPartnerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPartners = async () => {
    try {
      const res = await axios.get(`${API_BASE}/partners`);
      setPartners(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Kunne ikke hente partnere');
    }
  };

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { from: dateFrom, to: dateTo };
      if (partnerId) params.partnerId = partnerId;
      if (statusFilter) params.status = statusFilter;
      const res = await axios.get(`${API_BASE}/reports/orders`, { params });
      setSummary(res.data?.summary || null);
      setOrders(Array.isArray(res.data?.orders) ? res.data.orders : []);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      const fallback = `Fejl ${status || ''}: ${err.response?.statusText || 'Kunne ikke hente rapport'}`;
      setError(status === 401 ? 'Ikke logget ind' : status === 403 ? (msg || 'Ingen adgang') : (msg || fallback));
      setSummary(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    loadReport();
  }, [dateFrom, dateTo, partnerId, statusFilter]);

  const handleExport = async () => {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (partnerId) params.set('partnerId', partnerId);
    if (statusFilter) params.set('status', statusFilter);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/reports/orders.csv?${params}`, {
        responseType: 'text'
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      setError(status === 401 ? 'Ikke logget ind' : status === 403 ? (msg || 'Ingen adgang') : (msg || 'Kunne ikke eksportere CSV'));
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="reports-page">
      <h2>Rapporter</h2>
      {error && <div className="error" style={{ marginBottom: '0.5rem' }}>{error}</div>}
      <div className="reports-filters">
        <label>
          Fra
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          Til
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">Alle partnere</option>
          {partners.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Alle statusser</option>
          <option value="new">Ny</option>
          <option value="in_production">I produktion</option>
          <option value="ready">Klar</option>
          <option value="fulfilled">Leveret</option>
          <option value="cancelled">Annulleret</option>
        </select>
        <button type="button" onClick={loadReport} disabled={loading}>
          {loading ? 'Indlæser…' : 'Hent rapport'}
        </button>
      </div>

      {summary !== null && (
        <div className="reports-summary">
          <p><strong>I alt:</strong> {summary.total} ordrer</p>
          <p><strong>Leveret (delivered stops):</strong> {summary.deliveredStops ?? summary.fulfilled ?? 0}</p>
          <p><strong>I produktion:</strong> {summary.in_production ?? 0}</p>
          <p><strong>Klar:</strong> {summary.ready ?? 0}</p>
          {Object.keys(summary.byStatus || {}).length > 0 && (
            <p>
              {Object.entries(summary.byStatus).map(([s, n]) => (
                <span key={s} className="summary-badge">{s}: {n} </span>
              ))}
            </p>
          )}
        </div>
      )}

      {summary !== null && (
        <>
          <div className="reports-export">
            <button type="button" className="btn-export" onClick={handleExport}>
              Eksporter CSV
            </button>
          </div>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Ordre</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Modtaget</th>
                  <th>Oprettet af</th>
                  <th>Levering</th>
                  <th>Postnr</th>
                  <th>By</th>
                  <th>Produkter</th>
                  <th>Opdateret</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id}>
                    <td>{o.orderNumber || o.shopifyOrderName || o.shopifyOrderNumber}</td>
                    <td>{o.partner?.name || '–'}</td>
                    <td>{o.status}</td>
                    <td>{formatDate(o.receivedAt || o.createdAt)}</td>
                    <td>{o.createdByRole === 'partner' ? 'Partner' : 'Admin'}{o.createdByEmail ? ` (${o.createdByEmail})` : ''}</td>
                    <td>{formatDate(o.deliveryDate)}</td>
                    <td>{o.postcode || o.shippingAddress?.postalCode || '–'}</td>
                    <td>{o.city || o.shippingAddress?.city || '–'}</td>
                    <td>
                      {o.productSummary || (o.products || []).map((p) => `${p.quantity}x ${p.name}`).join(', ')}
                    </td>
                    <td>{o.updateCount > 0 ? `${formatDate(o.updatedAt)} ${o.updatedByEmail || ''}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
