import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function money(value) {
  return `${Number(value || 0).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DKK`;
}

function weekdayLabel(weekday) {
  const map = {
    1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday',
    5: 'Friday', 6: 'Saturday', 0: 'Sunday'
  };
  return map[weekday] || '-';
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState('finance');
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [partnerId, setPartnerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [financeReport, setFinanceReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const weekEnd = useMemo(() => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const loadPartners = async () => {
    try {
      const res = await axios.get(`${API_BASE}/partners`);
      setPartners(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load partners');
    }
  };

  const loadOrdersReport = async () => {
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
      setError(err.response?.data?.message || 'Could not load report');
      setSummary(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFinanceReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { weekStart };
      if (partnerId) params.partnerId = partnerId;
      const res = await axios.get(`${API_BASE}/reports/admin-weekly`, { params });
      setFinanceReport(res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load finance report');
      setFinanceReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    if (tab === 'orders') loadOrdersReport();
    else loadFinanceReport();
  }, [tab, weekStart, dateFrom, dateTo, partnerId, statusFilter]);

  const handleOrdersExport = async () => {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (partnerId) params.set('partnerId', partnerId);
    if (statusFilter) params.set('status', statusFilter);
    try {
      const res = await axios.get(`${API_BASE}/reports/orders.csv?${params}`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orders-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not export CSV');
    }
  };

  const handleFinanceExport = async () => {
    const params = new URLSearchParams({ weekStart });
    if (partnerId) params.set('partnerId', partnerId);
    try {
      const res = await axios.get(`${API_BASE}/reports/admin-weekly.csv?${params}`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-weekly-${weekStart}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not export CSV');
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const platformPercent = financeReport?.assumptions?.platformPercent ?? 20;

  return (
    <div className="reports-page">
      <h2>Reports</h2>
      <div className="reports-tabs">
        <button type="button" className={tab === 'finance' ? 'active' : ''} onClick={() => setTab('finance')}>Finance (weekly)</button>
        <button type="button" className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>Orders</button>
      </div>
      {error && <div className="error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

      <div className="reports-filters">
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
          <option value="">All partners</option>
          {partners.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        {tab === 'finance' ? (
          <>
            <label>
              Week start (Monday)
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </label>
            <button type="button" onClick={loadFinanceReport} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            <button type="button" className="btn-export" onClick={handleFinanceExport}>Excel (CSV)</button>
            <button type="button" onClick={() => window.print()}>Print</button>
          </>
        ) : (
          <>
            <label>Fra <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
            <label>Til <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Alle statusser</option>
              <option value="new">Ny</option>
              <option value="in_production">I produktion</option>
              <option value="ready">Klar</option>
              <option value="fulfilled">Leveret</option>
              <option value="cancelled">Annulleret</option>
            </select>
            <button type="button" onClick={loadOrdersReport} disabled={loading}>{loading ? 'Indlæser…' : 'Hent rapport'}</button>
            <button type="button" className="btn-export" onClick={handleOrdersExport}>Eksporter CSV</button>
          </>
        )}
      </div>

      {tab === 'finance' && financeReport && (
        <>
          <div className="reports-summary">
            <p><strong>Period:</strong> {financeReport.week?.from} → {financeReport.week?.to}</p>
            <p><strong>Orders:</strong> {financeReport.summary?.totals?.deliveries || 0}</p>
            <p><strong>Gross:</strong> {money(financeReport.summary?.totals?.gross)}</p>
            <p><strong>Stripe fee:</strong> {money(financeReport.summary?.totals?.feeAmount)}</p>
            <p><strong>Net after fee:</strong> {money(financeReport.summary?.totals?.netAfterFee)}</p>
            <p><strong>Flowers:</strong> {money(financeReport.summary?.totals?.flowerValue)}</p>
            <p><strong>Delivery (69 DKK/order):</strong> {money(financeReport.summary?.totals?.shipping)}</p>
            <p><strong>Platform ({platformPercent}%):</strong> {money(financeReport.summary?.totals?.platformCommission)}</p>
            <p><strong>Partner payout:</strong> {money(financeReport.summary?.totals?.partnerPayout)}</p>
          </div>

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Day</th><th>Deliveries</th><th>Gross</th><th>Stripe</th><th>Net</th>
                  <th>Flowers</th><th>Delivery</th><th>Platform</th><th>Partner</th>
                </tr>
              </thead>
              <tbody>
                {(financeReport.summary?.days || []).map((d) => (
                  <tr key={d.weekday}>
                    <td>{weekdayLabel(d.weekday)}</td>
                    <td>{d.deliveries}</td>
                    <td>{money(d.gross)}</td>
                    <td>{money(d.feeAmount)}</td>
                    <td>{money(d.netAfterFee)}</td>
                    <td>{money(d.flowerValue)}</td>
                    <td>{money(d.shipping)}</td>
                    <td>{money(d.platformCommission)}</td>
                    <td>{money(d.partnerPayout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="reports-table-wrap" style={{ marginTop: '1rem' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Order</th><th>Partner</th><th>Date</th><th>Status</th>
                  <th>Gross</th><th>Stripe</th><th>Flowers</th><th>Delivery</th><th>Platform</th><th>Partner payout</th>
                </tr>
              </thead>
              <tbody>
                {(financeReport.orders || []).map((o) => (
                  <tr key={o.orderId}>
                    <td>{o.orderNumber}</td>
                    <td>{o.partnerName || '–'}</td>
                    <td>{o.deliveryDate}</td>
                    <td>{o.status}</td>
                    <td>{money(o.gross)}</td>
                    <td>{money(o.feeAmount)}</td>
                    <td>{money(o.flowerValue)}</td>
                    <td>{money(o.shipping)}</td>
                    <td>{money(o.platformCommission)}</td>
                    <td>{money(o.partnerPayout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
            Week: {weekStart} → {weekEnd}. Stripe fee is deducted first, then 69 DKK delivery is separated, then platform takes {platformPercent}% from flowers.
          </p>
        </>
      )}

      {tab === 'orders' && summary !== null && (
        <>
          <div className="reports-summary">
            <p><strong>I alt:</strong> {summary.total} ordrer</p>
            <p><strong>Leveret:</strong> {summary.deliveredStops ?? summary.fulfilled ?? 0}</p>
          </div>
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Ordre</th><th>Partner</th><th>Status</th><th>Modtaget</th>
                  <th>Levering</th><th>Postnr</th><th>By</th><th>Produkter</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o._id}>
                    <td>{o.orderNumber || o.shopifyOrderName || o.shopifyOrderNumber}</td>
                    <td>{o.partner?.name || '–'}</td>
                    <td>{o.status}</td>
                    <td>{formatDate(o.receivedAt || o.createdAt)}</td>
                    <td>{formatDate(o.deliveryDate)}</td>
                    <td>{o.postcode || o.shippingAddress?.postalCode || '–'}</td>
                    <td>{o.city || o.shippingAddress?.city || '–'}</td>
                    <td>{o.productSummary || (o.products || []).map((p) => `${p.quantity}x ${p.name}`).join(', ')}</td>
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
