import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import OrderList from '../components/OrderList';
import { sortOrdersByDeliveryDate } from '../utils/orderSort';
import OrderDetail from '../components/OrderDetail';
import CreateOrderModal from '../components/CreateOrderModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';
const LS_DELIVERY_PRESET = 'northblomst_partner_deliveryPreset';
const LS_DELIVERY_DATE = 'northblomst_partner_deliveryDate';
const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

function getInitialDeliveryPreset() {
  try {
    const s = localStorage.getItem(LS_DELIVERY_PRESET);
    if (s && ['', 'today', 'tomorrow', 'date'].includes(s)) return s;
  } catch (_) {}
  return 'today';
}

function getInitialDeliveryDate() {
  try {
    return localStorage.getItem(LS_DELIVERY_DATE) || '';
  } catch (_) {}
  return '';
}

export default function PartnerDashboard() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [deliveryPreset, setDeliveryPreset] = useState(getInitialDeliveryPreset);
  const [deliveryDate, setDeliveryDate] = useState(getInitialDeliveryDate);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [weeklyView, setWeeklyView] = useState(false);
  const [selectedDayIso, setSelectedDayIso] = useState('');

  const toIsoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sunday
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const getDeliveryDateParam = () => {
    if (deliveryPreset === 'date' && deliveryDate) return deliveryDate;
    if (deliveryPreset === 'today') {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (deliveryPreset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return null;
  };

  const loadOrders = async () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (weeklyView) {
      params.from = toIsoDate(weekStart);
      params.to = toIsoDate(weekEnd);
    } else {
      const isoDate = getDeliveryDateParam();
      if (isoDate) params.deliveryDate = isoDate;
    }
    const res = await axios.get(`${API_BASE}/orders/partner`, { params });
    const sorted = sortOrdersByDeliveryDate(res.data);
    setOrders(sorted);
    setSelectedOrder((prev) => {
      const selectId = location.state?.selectOrderId;
      if (selectId) {
        const found = sorted.find((o) => String(o._id) === String(selectId));
        if (found) return found;
      }
      if (!prev && sorted.length > 0) return sorted[0];
      const updated = sorted.find((o) => o._id === prev?._id);
      return updated ?? prev ?? (sorted[0] || null);
    });
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, deliveryPreset, deliveryDate, weeklyView]);

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const iso = toIsoDate(d);
      const count = orders.filter((o) => o.deliveryDate && toIsoDate(new Date(o.deliveryDate)) === iso).length;
      days.push({
        iso,
        label: `${WEEKDAY_LABELS[i]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        count
      });
    }
    return days;
  }, [orders]);

  useEffect(() => {
    if (!weeklyView) {
      setSelectedDayIso('');
      return;
    }
    if (!selectedDayIso) {
      const todayIso = toIsoDate(new Date());
      setSelectedDayIso(todayIso);
    }
  }, [weeklyView, selectedDayIso]);

  const visibleOrders = useMemo(() => {
    if (!weeklyView || !selectedDayIso) return orders;
    return orders.filter((o) => o.deliveryDate && toIsoDate(new Date(o.deliveryDate)) === selectedDayIso);
  }, [orders, weeklyView, selectedDayIso]);

  useEffect(() => {
    if (!visibleOrders.length) {
      setSelectedOrder(null);
      return;
    }
    if (!selectedOrder || !visibleOrders.some((o) => o._id === selectedOrder._id)) {
      setSelectedOrder(visibleOrders[0]);
    }
  }, [visibleOrders, selectedOrder]);

  const handleOrderCreated = (order) => {
    setShowCreateOrder(false);
    loadOrders().then(() => {
      setSelectedOrder(order);
    });
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Mine ordrer</h2>
        <div className="header-actions">
          <button type="button" className="btn-primary" onClick={() => setShowCreateOrder(true)}>
            Opret ordre
          </button>
        </div>
        <div className="filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Alle statusser</option>
            <option value="new">Ny</option>
            <option value="assigned">Tildelt</option>
            <option value="in_production">I produktion</option>
            <option value="ready">Klar til levering</option>
            <option value="fulfilled">Leveret</option>
            <option value="cancelled">Annulleret</option>
          </select>
          <select
            value={deliveryPreset}
            onChange={(e) => {
              const v = e.target.value;
              setDeliveryPreset(v);
              if (v !== 'date') setDeliveryDate('');
              try {
                localStorage.setItem(LS_DELIVERY_PRESET, v);
                if (v !== 'date') localStorage.removeItem(LS_DELIVERY_DATE);
              } catch (_) {}
            }}
            title="Leveringsdato"
          >
            <option value="">Alle leveringsdatoer</option>
            <option value="today">I dag</option>
            <option value="tomorrow">I morgen</option>
            <option value="date">Vælg dato</option>
          </select>
          {deliveryPreset === 'date' && (
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => {
                const v = e.target.value;
                setDeliveryDate(v);
                try { localStorage.setItem(LS_DELIVERY_DATE, v); } catch (_) {}
              }}
              title="Leveringsdato"
            />
          )}
          <label className="weekly-toggle">
            <input
              type="checkbox"
              checked={weeklyView}
              onChange={(e) => setWeeklyView(e.target.checked)}
            />
            Ugevisning
          </label>
        </div>
      </div>
      {weeklyView && (
        <div className="week-strip">
          {weekDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              className={`week-day ${selectedDayIso === d.iso ? 'active' : ''}`}
              onClick={() => setSelectedDayIso(d.iso)}
            >
              <span>{d.label}</span>
              <strong>{d.count}</strong>
            </button>
          ))}
        </div>
      )}
      <div className="dashboard-body">
        <OrderList
          orders={visibleOrders}
          onSelect={setSelectedOrder}
          selectedId={selectedOrder?._id}
          showReceived={false}
          showAddress={true}
        />
        {selectedOrder && (
          <OrderDetail order={selectedOrder} onUpdated={loadOrders} />
        )}
      </div>
      {showCreateOrder && (
        <CreateOrderModal
          isAdmin={false}
          onClose={() => setShowCreateOrder(false)}
          onCreated={handleOrderCreated}
        />
      )}
    </div>
  );
}
