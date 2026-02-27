import React from 'react';

export default function OrderList({ orders, onSelect, selectedId, showPartner = false }) {
  return (
    <div className="order-list">
      {orders.map((o) => (
        <button
          key={o._id}
          className={`order-list-item ${selectedId === o._id ? 'selected' : ''}`}
          onClick={() => onSelect(o)}
        >
          <div className="order-main">
            <div className="order-name">{o.orderNumber || o.shopifyOrderName || o.shopifyOrderNumber}</div>
            <div className="order-badges-inline">
              <span className={`status status-${o.status}`}>
                {o.status === 'cancelled' ? 'Annulleret' : o.status === 'assigned' ? 'Tildelt' : o.status}
              </span>
              {(o.updateCount || 0) > 0 && (
                <span className="badge-inline" title={o.updatedAt ? new Date(o.updatedAt).toLocaleString('da-DK') : ''}>Opdateret</span>
              )}
            </div>
          </div>
          <div className="order-meta">
            <span>{o.recipientName || o.customer?.name}</span>
            <span>{o.postcode || o.shippingAddress?.postalCode} {o.city || o.shippingAddress?.city}</span>
            {(o.receivedAt || o.createdAt) && (
              <span title="Modtaget">
                Modtaget: {new Date(o.receivedAt || o.createdAt).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })} {new Date(o.receivedAt || o.createdAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {o.deliveryDate && (
              <span title="Levering">
                Levering: {new Date(o.deliveryDate).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
            {showPartner && <span>{o.partner?.name || 'Ikke tildelt'}</span>}
            {o.createdByRole === 'partner' && <span className="meta-created">Partner</span>}
          </div>
        </button>
      ))}
      {orders.length === 0 && <div className="empty">Ingen ordrer</div>}
    </div>
  );
}

