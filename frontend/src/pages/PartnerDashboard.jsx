import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import OrderList from '../components/OrderList';
import { sortOrdersNewestFirst } from '../utils/orderSort';
import OrderDetail from '../components/OrderDetail';
import CreateOrderModal from '../components/CreateOrderModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';
const LS_DELIVERY_PRESET = 'northblomst_partner_deliveryPreset';
const LS_DELIVERY_DATE = 'northblomst_partner_deliveryDate';

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
    const isoDate = getDeliveryDateParam();
    if (isoDate) params.deliveryDate = isoDate;
    const res = await axios.get(`${API_BASE}/orders/partner`, { params });
    setOrders(res.data);
    setSelectedOrder((prev) => {
      const selectId = location.state?.selectOrderId;
      if (selectId) {
        const found = res.data.find((o) => String(o._id) === String(selectId));
        if (found) return found;
      }
      if (!prev && res.data.length > 0) return res.data[0];
      const updated = res.data.find((o) => o._id === prev?._id);
      return updated ?? prev ?? (res.data[0] || null);
    });
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, deliveryPreset, deliveryDate]);

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
        </div>
      </div>
      <div className="dashboard-body">
        <OrderList orders={sortOrdersNewestFirst(orders)} onSelect={setSelectedOrder} selectedId={selectedOrder?._id} />
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
