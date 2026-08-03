import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';
const POLL_MS = 20000;

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/notifications/unread-count`);
      setUnreadCount(Number(data?.count) || 0);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/notifications`, { params: { limit: 25 } });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnreadCount(Number(data?.unreadCount) || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    loadList();
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, loadList]);

  const toggle = () => setOpen((v) => !v);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await axios.post(`${API_BASE}/notifications/read-all`);
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch {
      /* ignore */
    } finally {
      setMarking(false);
    }
  };

  const openNotification = async (n) => {
    if (!n?.orderId) return;
    if (!n.readAt) {
      try {
        await axios.patch(`${API_BASE}/notifications/${n.id}/read`);
        setUnreadCount((c) => Math.max(0, c - 1));
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
        );
      } catch {
        /* still navigate */
      }
    }
    setOpen(false);
    navigate('/partner', { state: { selectOrderId: n.orderId } });
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className={`notif-bell ${hasUnread ? 'has-unread' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`notif-bell-btn ${hasUnread ? 'is-alert' : ''}`}
        onClick={toggle}
        aria-label={hasUnread ? `${unreadCount} ulæste notifikationer` : 'Notifikationer'}
        title={hasUnread ? `${unreadCount} ny(e) ordre(r)` : 'Notifikationer'}
      >
        <span className="notif-bell-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2z" />
          </svg>
        </span>
        {hasUnread ? <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <strong>Notifikationer</strong>
            <button
              type="button"
              className="notif-mark-all"
              onClick={markAllRead}
              disabled={marking || !hasUnread}
            >
              {marking ? '…' : 'Markér alle som læst'}
            </button>
          </div>

          <div className="notif-list">
            {loading && !items.length ? (
              <p className="notif-empty">Henter…</p>
            ) : !items.length ? (
              <p className="notif-empty">Ingen notifikationer endnu</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item ${n.readAt ? 'is-read' : 'is-unread'}`}
                  onClick={() => openNotification(n)}
                >
                  <div className="notif-item-top">
                    <span className="notif-item-title">{n.title || 'Ny ordre modtaget'}</span>
                    <span className="notif-item-time">{formatWhen(n.createdAt)}</span>
                  </div>
                  <div className="notif-item-body">{n.body || n.orderNumber || ''}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
