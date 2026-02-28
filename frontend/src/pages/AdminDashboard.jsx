import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import OrderList from '../components/OrderList';
import { sortOrdersNewestFirst } from '../utils/orderSort';
import OrderDetail from '../components/OrderDetail';
import PartnerManager from '../components/PartnerManager';
import CreateOrderModal from '../components/CreateOrderModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';
const LS_DELIVERY_PRESET = 'northblomst_admin_deliveryPreset';
const LS_DELIVERY_DATE = 'northblomst_admin_deliveryDate';

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

export default function AdminDashboard() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [postalFilter, setPostalFilter] = useState('');
  const [deliveryPreset, setDeliveryPreset] = useState(getInitialDeliveryPreset);
  const [deliveryDate, setDeliveryDate] = useState(getInitialDeliveryDate);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [webhooks, setWebhooks] = useState([]);
  const [webhookMsg, setWebhookMsg] = useState('');
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [proxyTestMsg, setProxyTestMsg] = useState('');
  const [shopifyDisconnected, setShopifyDisconnected] = useState(false);
  const [shopifyReconnectUrl, setShopifyReconnectUrl] = useState(null);

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
    if (postalFilter) params.postalCode = postalFilter;
    const isoDate = getDeliveryDateParam();
    if (isoDate) params.deliveryDate = isoDate;
    const res = await axios.get(`${API_BASE}/orders/admin`, { params });
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
  }, [statusFilter, postalFilter, deliveryPreset, deliveryDate]);

  useEffect(() => {
    loadWebhooks();
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE}/shopify/status`);
        const ok = res.data?.connected === true;
        setShopifyDisconnected(!ok);
        if (!ok && res.data?.reconnectUrl) setShopifyReconnectUrl(res.data.reconnectUrl);
        else if (ok) setShopifyReconnectUrl(null);
      } catch {
        setShopifyDisconnected(true);
        setShopifyReconnectUrl(null);
      }
    };
    checkStatus();

    const onDisconnected = (e) => {
      setShopifyDisconnected(true);
      if (e?.detail?.reconnectUrl) setShopifyReconnectUrl(e.detail.reconnectUrl);
    };
    window.addEventListener('shopify-disconnected', onDisconnected);
    return () => window.removeEventListener('shopify-disconnected', onDisconnected);
  }, []);

  const handleOrderCreated = (order) => {
    setShowCreateOrder(false);
    loadOrders().then(() => {
      setSelectedOrder(order);
    });
  };

  const loadWebhooks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/webhooks`);
      setWebhooks(Array.isArray(res.data) ? res.data : []);
      setWebhookMsg('');
    } catch (e) {
      setWebhooks([]);
      const d = e.response?.data;
      if (d?.code === 'SHOPIFY_TOKEN_INVALID') {
        setShopifyDisconnected(true);
        if (d.reconnectUrl) setShopifyReconnectUrl(d.reconnectUrl);
      }
      setWebhookMsg(d?.message || e.response?.data?.message || 'Kunne ikke hente webhooks');
    }
  };

  const handleSetupWebhooks = async () => {
    setWebhookMsg('');
    setWebhookLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/setup-webhooks`);
      setWebhookMsg(res.data?.message || 'Webhooks oprettet');
      await loadWebhooks();
    } catch (e) {
      setWebhookMsg(e.response?.data?.message || e.message || 'Fejl ved opsætning');
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleTestProxy = async () => {
    setProxyTestMsg('');
    try {
      const res = await axios.get(`${API_BASE}/shopify/test-proxy`);
      setProxyTestMsg(`✓ Proxy OK: ${res.data?.shopName || 'OK'}`);
    } catch (e) {
      setProxyTestMsg(e.response?.data?.message || e.message || 'Proxy fejlet');
    }
  };

  const handleSyncFromShopify = async () => {
    setSyncMsg('');
    setSyncLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders/sync-from-shopify`);
      setSyncMsg(res.data?.synced >= 0 ? `Synced ${res.data.synced} nye ordrer` : 'Sync færdig');
      await loadOrders();
    } catch (e) {
      const msg = e.response?.data?.message || e.message || '';
      setSyncMsg(
        msg ||
          'Shopify CLI kører ikke eller porten har ændret sig. 1) Start i terminal: cd profitable-vertical-app && shopify app dev --store=northblomst-dev.myshopify.com --use-localhost --localhost-port=3456. 2) Sæt i .env: SHOPIFY_PROXY_URL=http://localhost:3456. 3) Genstart backend.'
      );
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDeleteWebhook = async (id) => {
    if (!window.confirm('Slet webhook?')) return;
    try {
      await axios.delete(`${API_BASE}/webhooks/${id}`);
      setWebhookMsg('Webhook slettet');
      await loadWebhooks();
    } catch (e) {
      setWebhookMsg(e.response?.data?.message || 'Kunne ikke slette');
    }
  };

  return (
    <div className="dashboard admin">
      {shopifyDisconnected && (
        <div
          style={{
            background: '#c62828',
            color: 'white',
            padding: '10px 16px',
            marginBottom: '1rem',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10
          }}
        >
          <span>Shopify disconnected. Reconnect required.</span>
          {shopifyReconnectUrl ? (
            <button
              type="button"
              onClick={() => { window.location.href = shopifyReconnectUrl; }}
              style={{
                background: 'white',
                color: '#c62828',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reconnect Shopify
            </button>
          ) : null}
        </div>
      )}
      <div className="dashboard-header">
        <h2>Admin oversigt</h2>
        <div className="header-actions">
          <button type="button" className="btn-secondary" onClick={handleTestProxy}>
            Test proxy
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#28a745' }}
            onClick={handleSyncFromShopify}
            disabled={syncLoading}
          >
            {syncLoading ? 'Syncer…' : 'Sync ordre fra Shopify'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSetupWebhooks}
            disabled={webhookLoading}
          >
            {webhookLoading ? 'Opretter…' : 'Setup Webhooks'}
          </button>
          <button type="button" className="btn-primary" onClick={() => setShowCreateOrder(true)}>
            Opret ordre
          </button>
        </div>
        {proxyTestMsg && (
          <div style={{ marginTop: 8, fontSize: 13, color: proxyTestMsg.startsWith('✓') ? '#2e7d32' : '#c62828' }}>
            {proxyTestMsg}
          </div>
        )}
        {syncMsg && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: syncMsg.includes('Synced') ? '#e8f5e9' : '#ffebee',
              color: syncMsg.includes('Synced') ? '#1b5e20' : '#b71c1c',
              borderRadius: 6,
              whiteSpace: 'pre-wrap',
              fontSize: 13
            }}
          >
            {syncMsg}
          </div>
        )}
        <div className="filters">
          <input
            placeholder="Postnummer"
            value={postalFilter}
            onChange={(e) => setPostalFilter(e.target.value)}
          />
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
        <OrderList orders={sortOrdersNewestFirst(orders)} onSelect={setSelectedOrder} selectedId={selectedOrder?._id} showPartner />
        {selectedOrder && (
          <OrderDetail order={selectedOrder} onUpdated={loadOrders} isAdmin />
        )}
      </div>
      <div className="admin-partners">
        <PartnerManager />
      </div>
      <div className="admin-webhooks" style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: 8 }}>
        <h3>Shopify Webhooks</h3>
        {webhookMsg && <p style={{ color: webhookMsg.includes('Fejl') ? '#c00' : '#060' }}>{webhookMsg}</p>}
        <button type="button" className="btn-secondary" onClick={loadWebhooks}>
          Opdater liste
        </button>
        <ul style={{ marginTop: '0.5rem', listStyle: 'none', padding: 0 }}>
          {webhooks.map((w) => (
            <li key={w.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span>{w.topic}</span>
              <span style={{ fontSize: 12, color: '#666' }}>{w.address}</span>
              <button type="button" onClick={() => handleDeleteWebhook(w.id)} style={{ fontSize: 12 }}>
                Slet
              </button>
            </li>
          ))}
        </ul>
      </div>
      {showCreateOrder && (
        <CreateOrderModal
          isAdmin
          onClose={() => setShowCreateOrder(false)}
          onCreated={handleOrderCreated}
        />
      )}
    </div>
  );
}
