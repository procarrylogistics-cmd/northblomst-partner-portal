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

export default function PartnerReportsPage() {
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [feePercent, setFeePercent] = useState('2.39');
  const [feeFixed, setFeeFixed] = useState('0');
  const [platformPercent, setPlatformPercent] = useState('20');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { weekStart, feePercent, feeFixed, platformPercent };
      const res = await axios.get(`${API_BASE}/reports/partner-weekly`, { params });
      setReport(res.data || null);
    } catch (err) {
      setReport(null);
      setError(err.response?.data?.message || 'Kunne ikke hente partner-rapport');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [weekStart, feePercent, feeFixed, platformPercent]);

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams({ weekStart, feePercent, feeFixed, platformPercent });
      const res = await axios.get(`${API_BASE}/reports/partner-weekly.csv?${params}`, { responseType: 'text' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partner-weekly-${weekStart}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Kunne ikke eksportere CSV');
    }
  };

  return (
    <div className="reports-page partner-reports-page">
      <h2>Partner rapport (uge)</h2>
      {error && <div className="error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

      <div className="reports-filters">
        <label>
          Uge start (mandag)
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        </label>
        <label>
          Fee %
          <input type="number" step="0.01" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} />
        </label>
        <label>
          Fee fast (DKK)
          <input type="number" step="0.01" value={feeFixed} onChange={(e) => setFeeFixed(e.target.value)} />
        </label>
        <label>
          Platform %
          <input type="number" step="0.01" value={platformPercent} onChange={(e) => setPlatformPercent(e.target.value)} />
        </label>
        <button type="button" onClick={loadReport} disabled={loading}>{loading ? 'Indlæser…' : 'Opdater'}</button>
        <button type="button" className="btn-export" onClick={exportExcel}>Excel (CSV)</button>
        <button type="button" onClick={() => window.print()}>Print</button>
      </div>

      {report && (
        <>
          <div className="reports-summary">
            <p><strong>Periode:</strong> {report.week?.from} → {report.week?.to}</p>
            <p><strong>Ordrer:</strong> {report.summary?.totals?.deliveries || 0}</p>
            <p><strong>Brutto:</strong> {money(report.summary?.totals?.gross)}</p>
            <p><strong>Fee:</strong> {money(report.summary?.totals?.feeAmount)}</p>
            <p><strong>Netto efter fee:</strong> {money(report.summary?.totals?.netAfterFee)}</p>
            <p><strong>Transport:</strong> {money(report.summary?.totals?.shipping)}</p>
            <p><strong>Blomster:</strong> {money(report.summary?.totals?.flowerValue)}</p>
            <p><strong>Platform ({platformPercent}%):</strong> {money(report.summary?.totals?.platformCommission)}</p>
            <p><strong>Partner payout:</strong> {money(report.summary?.totals?.partnerPayout)}</p>
            <small>Estimare: fee procent + fee fix (poți ajusta sus).</small>
          </div>

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Zi</th>
                  <th>Livrări</th>
                  <th>Brutto</th>
                  <th>Fee</th>
                  <th>Netto</th>
                  <th>Transport</th>
                  <th>Flori</th>
                  <th>Platform</th>
                  <th>Partner</th>
                </tr>
              </thead>
              <tbody>
                {(report.summary?.days || []).map((d) => (
                  <tr key={d.weekday}>
                    <td>{d.label}</td>
                    <td>{d.deliveries}</td>
                    <td>{money(d.gross)}</td>
                    <td>{money(d.feeAmount)}</td>
                    <td>{money(d.netAfterFee)}</td>
                    <td>{money(d.shipping)}</td>
                    <td>{money(d.flowerValue)}</td>
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
                  <th>Ordre</th>
                  <th>Dato</th>
                  <th>Status</th>
                  <th>Recipient</th>
                  <th>By</th>
                  <th>Brutto</th>
                  <th>Fee</th>
                  <th>Transport</th>
                  <th>Flori</th>
                  <th>Platform</th>
                  <th>Partner</th>
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
                    <td>{money(o.gross)}</td>
                    <td>{money(o.feeAmount)}</td>
                    <td>{money(o.shipping)}</td>
                    <td>{money(o.flowerValue)}</td>
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
        Exemplu logică: Brutto - fee = Netto. Din Netto, transportul merge la partener, iar din flori platforma ia procentul setat.
      </p>
      <p style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#6b7280' }}>
        Săptămână curentă: {weekStart} → {weekEnd}
      </p>
    </div>
  );
}

