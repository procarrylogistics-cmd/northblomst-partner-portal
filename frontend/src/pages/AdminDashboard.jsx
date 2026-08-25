import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import OrderList from '../components/OrderList';
import { sortOrdersNewestFirst } from '../utils/orderSort';
import OrderDetail from '../components/OrderDetail';
import CreateOrderModal from '../components/CreateOrderModal';
import ManualCardPrintModal from '../components/ManualCardPrintModal';

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
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [postalFilter, setPostalFilter] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [deliveryPreset, setDeliveryPreset] = useState(getInitialDeliveryPreset);
  const [deliveryDate, setDeliveryDate] = useState(getInitialDeliveryDate);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showManualCard, setShowManualCard] = useState(false);
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
    const search = orderSearch.trim();
    if (search) params.q = search;
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
  }, [statusFilter, postalFilter, orderSearch, deliveryPreset, deliveryDate]);

  useEffect(() => {
    if (location.state?.openManualCard) {
      setShowManualCard(true);
      navigate('/admin', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

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
        <div className="alert-banner alert-danger">
          <span>Shopify disconnected. Reconnect required.</span>
          {shopifyReconnectUrl ? (
            <button
              type="button"
              className="alert-banner-action"
              onClick={() => {
                window.location.href = shopifyReconnectUrl;
              }}
            >
              Reconnect Shopify
            </button>
          ) : null}
        </div>
      )}

      <div className="page-hero">
        <div className="page-hero-text">
          <p className="page-eyebrow">Operations</p>
          <h2>Admin oversigt</h2>
          <p className="page-lede">Ordrer og Shopify — samlet i ét arbejdsrum.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-primary" onClick={() => setShowCreateOrder(true)}>
            Opret ordre
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowManualCard(true)}>
            Print kort manuelt
          </button>
          <button
            type="button"
            className="btn-primary btn-sync"
            onClick={handleSyncFromShopify}
            disabled={syncLoading}
          >
            {syncLoading ? 'Syncer…' : 'Sync Shopify'}
          </button>
          <button type="button" className="btn-ghost" onClick={handleTestProxy}>
            Test proxy
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleSetupWebhooks}
            disabled={webhookLoading}
          >
            {webhookLoading ? 'Opretter…' : 'Setup webhooks'}
          </button>
        </div>
      </div>

      {proxyTestMsg && (
        <div className={`inline-toast ${proxyTestMsg.startsWith('✓') ? 'is-ok' : 'is-bad'}`}>
          {proxyTestMsg}
        </div>
      )}
      {syncMsg && (
        <div className={`inline-toast ${syncMsg.includes('Synced') ? 'is-ok' : 'is-bad'} is-block`}>
          {syncMsg}
        </div>
      )}

      <div className="toolbar-card">
        <div className="filters">
          <input
            placeholder="Søg ordrenummer"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            title="Søg efter ordrenummer"
            aria-label="Søg ordrenummer"
          />
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
                try {
                  localStorage.setItem(LS_DELIVERY_DATE, v);
                } catch (_) {}
              }}
              title="Leveringsdato"
            />
          )}
        </div>
        <p className="toolbar-meta">{orders.length} ordrer</p>
      </div>

      <div className="dashboard-body">
        <section className="panel-col">
          <div className="panel-label">Ordrer</div>
          <OrderList
            orders={sortOrdersNewestFirst(orders)}
            onSelect={setSelectedOrder}
            selectedId={selectedOrder?._id}
            showPartner
          />
        </section>
        <section className="panel-col">
          <div className="panel-label">Ordredetaljer</div>
          {selectedOrder ? (
            <OrderDetail order={selectedOrder} onUpdated={loadOrders} isAdmin />
          ) : (
            <div className="order-detail empty-panel">Vælg en ordre</div>
          )}
        </section>
      </div>

      <section className="admin-section">
        <div className="panel-label">Shopify webhooks</div>
        <div className="admin-webhooks surface-card">
          {webhookMsg && (
            <p className={webhookMsg.includes('Fejl') ? 'msg-bad' : 'msg-ok'}>{webhookMsg}</p>
          )}
          <button type="button" className="btn-secondary" onClick={loadWebhooks}>
            Opdater liste
          </button>
          <ul className="webhook-list">
            {webhooks.map((w) => (
              <li key={w.id} className="webhook-row">
                <span className="webhook-topic">{w.topic}</span>
                <span className="webhook-addr">{w.address}</span>
                <button type="button" className="btn-ghost btn-tiny" onClick={() => handleDeleteWebhook(w.id)}>
                  Slet
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {showCreateOrder && (
        <CreateOrderModal
          isAdmin
          onClose={() => setShowCreateOrder(false)}
          onCreated={handleOrderCreated}
        />
      )}
      <ManualCardPrintModal open={showManualCard} onClose={() => setShowManualCard(false)} />
    </div>
  );
}
