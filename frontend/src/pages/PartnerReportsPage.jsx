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

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function money(value) {
  return `${Number(value || 0).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DKK`;
}

function weekdayLabel(weekday) {
  const map = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    0: 'Sunday'
  };
  return map[weekday] || '-';
}

export default function PartnerReportsPage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const platformPercent = report?.assumptions?.platformPercent ?? 20;

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/reports/partner-weekly`, { params: { weekStart } });
      setReport(res.data || null);
    } catch (err) {
      setReport(null);
      setError(err.response?.data?.message || 'Could not load partner report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [weekStart]);

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams({ weekStart });
      const res = await axios.get(`${API_BASE}/reports/partner-weekly.csv?${params}`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partner-weekly-${weekStart}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not export CSV');
    }
  };

  return (
    <div className="reports-page partner-reports-page">
      <h2>Partner Weekly Report</h2>
      {error && <div className="error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

      <div className="reports-filters">
        <label>
          Week start (Monday)
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        </label>
        <button type="button" onClick={loadReport} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button type="button" className="btn-export" onClick={exportExcel}>Excel (CSV)</button>
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>

      {report && (
        <>
          <div className="reports-summary">
            <p><strong>Period:</strong> {report.week?.from} → {report.week?.to}</p>
            <p><strong>Orders:</strong> {report.summary?.totals?.deliveries || 0}</p>
            <p><strong>Flowers (after payment processing):</strong> {money(report.summary?.totals?.flowerValue)}</p>
            <p><strong>Delivery (69 DKK per order):</strong> {money(report.summary?.totals?.shipping)}</p>
            <p><strong>Platform fee ({platformPercent}% of flowers):</strong> {money(report.summary?.totals?.platformCommission)}</p>
            <p><strong>Your payout:</strong> {money(report.summary?.totals?.partnerPayout)}</p>
          </div>

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Deliveries</th>
                  <th>Flowers</th>
                  <th>Delivery</th>
                  <th>Platform fee</th>
                  <th>Your payout</th>
                </tr>
              </thead>
              <tbody>
                {(report.summary?.days || []).map((d) => (
                  <tr key={d.weekday}>
                    <td>{weekdayLabel(d.weekday)}</td>
                    <td>{d.deliveries}</td>
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
                  <th>Order</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recipient</th>
                  <th>City</th>
                  <th>Flowers</th>
                  <th>Delivery</th>
                  <th>Platform fee</th>
                  <th>Your payout</th>
                </tr>
              </thead>
              <tbody>
                {(report.orders || []).map((o) => (
                  <tr key={o.orderId}>
                    <td>{o.orderNumber}</td>
                    <td>{o.deliveryDate}</td>
                    <td>{o.status}</td>
                    <td>{o.recipientName || '-'}</td>
                    <td>{`${o.postcode || ''} ${o.city || ''}`.trim() || '-'}</td>
                    <td>{money(o.flowerValue)}</td>
                    <td>{money(o.shipping)}</td>
                    <td>{money(o.platformCommission)}</td>
                    <td>{money(o.partnerPayout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
        Flowers = amount after payment processing, minus 69 DKK delivery. Platform fee is {platformPercent}% of flowers only. Delivery always goes to you.
      </p>
      <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6b7280' }}>
        Current week: {weekStart} → {weekEnd}
      </p>
    </div>
  );
}
