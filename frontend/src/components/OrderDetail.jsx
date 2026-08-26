import React, { useState, useEffect } from 'react';
import axios from 'axios';
import EditOrderModal from './EditOrderModal';
import { resolveProductLink } from '../utils/productLink';
import { toDateInputValue } from '../utils/dateInput';
import { extractCardMessage } from '../utils/cardMessage';
import { printCardText, CARD_VARIANTS } from '../utils/printCardText';
import { calculateOrderFinance, formatMoney, DEFAULT_PLATFORM_PERCENT } from '../utils/orderFinance';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '/api';

function buildInvoiceFormFromOrder(o) {
  const inv = o.invoiceDetails || {};
  const ba = o.billingAddress || {};
  const ship = o.shippingAddress || {};
  const hasBilling = !!(ba.address1 || o.billingName);
  const defaults = {
    name: o.billingName || o.recipientName || o.customer?.name || '',
    company: o.billingCompany || '',
    vatNumber: '',
    address1: hasBilling ? ba.address1 || '' : ship.address1 || o.address || '',
    address2: hasBilling ? ba.address2 || '' : ship.address2 || '',
    postalCode: hasBilling ? ba.postalCode || '' : ship.postalCode || o.postcode || '',
    city: hasBilling ? ba.city || '' : ship.city || o.city || '',
    country: hasBilling ? ba.country || '' : ship.country || 'DK',
    email: o.customer?.email || '',
    phone: o.phone || o.customer?.phone || ''
  };
  const keys = Object.keys(defaults);
  const form = {};
  keys.forEach((k) => {
    form[k] = inv[k] !== undefined && inv[k] !== null ? inv[k] : defaults[k];
  });
  return form;
}

const emptyInvoiceForm = {
  name: '',
  company: '',
  vatNumber: '',
  address1: '',
  address2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  phone: ''
};

export default function OrderDetail({ order: orderProp, onUpdated, isAdmin = false }) {
  const [displayOrder, setDisplayOrder] = useState(orderProp);
  const [printLoading, setPrintLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const order = displayOrder;
  const [trackingNumber, setTrackingNumber] = useState(orderProp.trackingNumber || '');
  const [trackingUrl, setTrackingUrl] = useState(orderProp.trackingUrl || '');
  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [assignMessage, setAssignMessage] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [trackMessage, setTrackMessage] = useState('');
  const [trackPushLoading, setTrackPushLoading] = useState(false);
  const [deliveryDateInput, setDeliveryDateInput] = useState(() => toDateInputValue(orderProp.deliveryDate));
  const [deliveryDateSaving, setDeliveryDateSaving] = useState(false);
  const [deliveryDateMessage, setDeliveryDateMessage] = useState('');
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceLang, setInvoiceLang] = useState('da');
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState('');

  const currentPartnerId = order.partner?._id ?? order.partner ?? null;
  const currentPartnerIdStr = currentPartnerId ? String(currentPartnerId) : '';

  useEffect(() => {
    setDisplayOrder(orderProp);
  }, [orderProp._id]);

  useEffect(() => {
    if (!orderProp._id) return;
    let cancelled = false;
    axios.get(`${API_BASE}/orders/${orderProp._id}`).then((res) => {
      if (!cancelled) setDisplayOrder(res.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [orderProp._id]);

  useEffect(() => {
    setTrackingNumber(order.trackingNumber || '');
    setTrackingUrl(order.trackingUrl || '');
    setSelectedPartnerId(currentPartnerIdStr);
    setDeliveryDateInput(toDateInputValue(order.deliveryDate));
    setDeliveryDateMessage('');
  }, [order._id, order.trackingNumber, order.trackingUrl, currentPartnerIdStr, order.deliveryDate]);

  const saveDeliveryDate = async () => {
    if (!deliveryDateInput) return;
    setDeliveryDateSaving(true);
    setDeliveryDateMessage('');
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}`, { deliveryDate: deliveryDateInput });
      setDeliveryDateMessage('Leveringsdato gemt');
      await onUpdated();
    } catch (err) {
      setDeliveryDateMessage(err.response?.data?.message || 'Kunne ikke gemme dato');
    } finally {
      setDeliveryDateSaving(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    axios.get(`${API_BASE}/partners`).then((res) => {
      if (!cancelled) setPartners(res.data);
    });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const updateStatus = async (status) => {
    setUpdating(true);
    setStatusError('');
    setTrackMessage('');
    try {
      const res = await axios.patch(`${API_BASE}/orders/${order._id}/status`, { status });
      const tp = res.data?.trackPush;
      if (status === 'ready' && tp) {
        if (tp.ok && !tp.skipped) {
          setTrackMessage(tp.created ? 'Ordre sendt til Procarry Track' : 'Ordre allerede i Track');
        } else if (tp.ok && tp.skipped && tp.reason === 'already_pushed') {
          setTrackMessage('Ordre var allerede sendt til Track');
        } else if (!tp.ok) {
          setStatusError(`Track: ${tp.error || 'Kunne ikke sende ordre'}`);
        }
      }
      await onUpdated();
    } catch (err) {
      console.error(err);
      setStatusError(err.response?.data?.message || 'Kunne ikke opdatere status');
    } finally {
      setUpdating(false);
    }
  };

  const pushToTrack = async (force = false) => {
    setTrackPushLoading(true);
    setStatusError('');
    setTrackMessage('');
    try {
      const res = await axios.post(`${API_BASE}/orders/${order._id}/push-procarry-track`, { force });
      const tp = res.data?.trackPush;
      if (tp?.ok && !tp.skipped) {
        setTrackMessage(tp.created ? 'Ordre sendt til Procarry Track' : 'Ordre synkroniseret med Track');
      } else if (tp?.ok && tp.skipped) {
        setTrackMessage('Ordre er allerede i Track');
      } else {
        setStatusError(`Track: ${tp?.error || 'Kunne ikke sende ordre'}`);
      }
      await onUpdated();
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Kunne ikke sende til Track');
    } finally {
      setTrackPushLoading(false);
    }
  };

  const saveTracking = async () => {
    setUpdating(true);
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/tracking`, {
        trackingNumber,
        trackingUrl
      });
      await onUpdated();
    } finally {
      setUpdating(false);
    }
  };

  const cardMessage = extractCardMessage(order);
  const finance = calculateOrderFinance(order);

  const handlePrintCardText = (variant = CARD_VARIANTS.normal) => {
    if (!cardMessage) {
      alert('Ingen korttekst fundet på denne ordre.');
      return;
    }
    printCardText(order, cardMessage, { variant });
  };

  const handlePrint = async () => {
    setPrintLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/orders/${order._id}/print-packing-slip`, {
        responseType: 'text'
      });
      const win = window.open('', '_blank');
      if (!win) {
        alert('Tillad pop-ups for at printe pakkeseddel.');
        return;
      }
      win.document.write(res.data);
      win.document.close();
    } catch (err) {
      console.error('Print failed', err);
      setStatusError(err.response?.data?.message || 'Kunne ikke hente produktionsseddel');
    } finally {
      setPrintLoading(false);
    }
  };

  const openInvoiceDrawer = () => {
    setInvoiceMessage('');
    setShowInvoiceDrawer(true);
  };

  const selectInvoiceLanguage = (lang) => {
    setInvoiceLang(lang);
    setInvoiceForm(buildInvoiceFormFromOrder(order));
    setInvoiceMessage('');
    setShowInvoiceDrawer(false);
    setShowInvoiceModal(true);
  };

  const openInvoiceModal = () => {
    openInvoiceDrawer();
  };

  const saveInvoiceDetails = async () => {
    const res = await axios.patch(`${API_BASE}/orders/${order._id}/invoice-details`, invoiceForm);
    setDisplayOrder(res.data);
    return res.data;
  };

  const handlePrintInvoice = async () => {
    setInvoiceLoading(true);
    setInvoiceMessage('');
    try {
      await saveInvoiceDetails();
      const res = await axios.get(`${API_BASE}/orders/${order._id}/customer-invoice`, {
        params: { lang: invoiceLang },
        responseType: 'text'
      });
      const win = window.open('', '_blank');
      if (!win) {
        setInvoiceMessage('Tillad pop-ups for at åbne faktura.');
        return;
      }
      win.document.write(res.data);
      win.document.close();
      setInvoiceMessage('Fakturaoplysninger gemt');
      await onUpdated();
    } catch (err) {
      setInvoiceMessage(err.response?.data?.message || 'Kunne ikke hente faktura');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    setInvoiceLoading(true);
    setInvoiceMessage('');
    try {
      await saveInvoiceDetails();
      const res = await axios.post(`${API_BASE}/orders/${order._id}/send-customer-invoice`, {
        email: invoiceForm.email.trim() || undefined,
        lang: invoiceLang
      });
      setInvoiceMessage(res.data?.message || 'Faktura sendt');
      await onUpdated();
    } catch (err) {
      setInvoiceMessage(err.response?.data?.message || 'Kunne ikke sende faktura');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleSaveInvoiceOnly = async () => {
    setInvoiceLoading(true);
    setInvoiceMessage('');
    try {
      await saveInvoiceDetails();
      setInvoiceMessage('Fakturaoplysninger gemt');
      await onUpdated();
    } catch (err) {
      setInvoiceMessage(err.response?.data?.message || 'Kunne ikke gemme');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedPartnerId) return;
    setAssigning(true);
    setAssignMessage('');
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/assign`, {
        partnerId: selectedPartnerId
      });
      setAssignMessage('Tildelt!');
      await onUpdated();
      setTimeout(() => setAssignMessage(''), 3000);
    } catch (err) {
      setAssignMessage(err.response?.data?.message || 'Kunne ikke tildele');
    } finally {
      setAssigning(false);
    }
  };

  const handleCancel = async () => {
    setUpdating(true);
    try {
      await axios.patch(`${API_BASE}/orders/${order._id}/cancel`, { reason: cancelReason });
      setShowCancelConfirm(false);
      setCancelReason('');
      await onUpdated();
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Kunne ikke annullere');
    } finally {
      setUpdating(false);
    }
  };

  const isCancelled = order.status === 'cancelled';

  const receivedAt = order.receivedAt || order.createdAt;
  const receivedStr = receivedAt
    ? new Date(receivedAt).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' }) + ' ' +
      new Date(receivedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    : '';
  const deliveryStr = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })
    : '';

  return (
    <div className="order-detail">
      <h3>{order.orderNumber || order.shopifyOrderName || order.shopifyOrderNumber}</h3>
      <div className="order-badges">
        {order.createdByRole === 'partner' && <span className="badge badge-created">Oprettet af partner</span>}
        {order.createdByRole === 'admin' && <span className="badge badge-created">Oprettet af admin</span>}
        {(order.updateCount || 0) > 0 && (
          <span className="badge badge-updated" title={order.updatedAt ? `Sidst opdateret: ${new Date(order.updatedAt).toLocaleString('da-DK')}${order.updatedByEmail ? ` af ${order.updatedByEmail}` : ''}` : ''}>
            Opdateret{order.updatedAt ? ` ${new Date(order.updatedAt).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' })} ${new Date(order.updatedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
        )}
        {isCancelled && <span className="badge badge-cancelled">Annulleret</span>}
      </div>
      {(deliveryStr || isAdmin || (isAdmin && receivedStr)) && (
        <p className="order-timestamps">
          {isAdmin && receivedStr && <span><strong>Modtaget:</strong> {receivedStr}</span>}
          {isAdmin && receivedStr && (deliveryStr || isAdmin) && ' · '}
          {isAdmin && !isCancelled ? (
            <span className="delivery-date-edit">
              <strong>Levering:</strong>{' '}
              <input
                type="date"
                className="delivery-date-input"
                value={deliveryDateInput}
                onChange={(e) => setDeliveryDateInput(e.target.value)}
                disabled={deliveryDateSaving}
              />
              <button
                type="button"
                className="delivery-date-save"
                onClick={saveDeliveryDate}
                disabled={deliveryDateSaving || !deliveryDateInput}
              >
                {deliveryDateSaving ? 'Gemmer…' : 'Gem dato'}
              </button>
            </span>
          ) : (
            deliveryStr && <span><strong>Levering:</strong> {deliveryStr}</span>
          )}
        </p>
      )}
      {finance && (
        <div className={`order-finance ${isAdmin ? 'order-finance-admin' : 'order-finance-partner'}`}>
          <strong>{isAdmin ? 'Finance breakdown' : 'Your payout'}</strong>
          {isAdmin ? (
            <ul className="order-finance-list">
              <li><span>Customer paid</span><span>{formatMoney(finance.gross, finance.currency)}</span></li>
              <li><span>Payment processing fee</span><span>- {formatMoney(finance.feeAmount, finance.currency)}</span></li>
              <li><span>Net after fee</span><span>{formatMoney(finance.netAfterFee, finance.currency)}</span></li>
              <li><span>Flower price</span><span>{formatMoney(finance.flowerValue, finance.currency)}</span></li>
              <li><span>Platform ({finance.platformPercent}%)</span><span>- {formatMoney(finance.platformCommission, finance.currency)}</span></li>
              <li><span>Partner excl. MOMS</span><span>{formatMoney(finance.partnerPayoutExMoms, finance.currency)}</span></li>
              <li><span>MOMS ({finance.momsPercent}%)</span><span>{formatMoney(finance.partnerPayoutMoms, finance.currency)}</span></li>
              <li>
                <span>{finance.handlesDelivery === false ? 'Delivery (kept by Northblomst)' : 'Delivery'}</span>
                <span>{formatMoney(finance.shipping, finance.currency)}</span>
              </li>
              <li className="order-finance-total"><span>Partner payout (inkl. MOMS)</span><span>{formatMoney(finance.partnerPayoutInclMoms ?? finance.partnerPayout, finance.currency)}</span></li>
            </ul>
          ) : (
            <ul className="order-finance-list">
              <li><span>Flower price</span><span>{formatMoney(finance.flowerValue, finance.currency)}</span></li>
              <li><span>Platform fee ({DEFAULT_PLATFORM_PERCENT}%)</span><span>- {formatMoney(finance.platformCommission, finance.currency)}</span></li>
              <li><span>Excl. MOMS</span><span>{formatMoney(finance.partnerPayoutExMoms, finance.currency)}</span></li>
              <li><span>MOMS ({finance.momsPercent}%)</span><span>{formatMoney(finance.partnerPayoutMoms, finance.currency)}</span></li>
              <li>
                <span>{finance.handlesDelivery === false ? 'Delivery (not included)' : 'Delivery'}</span>
                <span>{formatMoney(finance.shipping, finance.currency)}</span>
              </li>
              <li className="order-finance-total"><span>Your payout (inkl. MOMS)</span><span>{formatMoney(finance.partnerPayoutInclMoms ?? finance.partnerPayout, finance.currency)}</span></li>
            </ul>
          )}
        </div>
      )}
      {deliveryDateMessage && <p className="delivery-date-msg">{deliveryDateMessage}</p>}
      <p className="order-customer">
        <strong>Kunde:</strong> {order.recipientName || order.customer?.name} ({order.phone || order.customer?.phone})
      </p>
      {isAdmin && (
        <p>
          <strong>Leveringsadresse:</strong><br />
          {order.address || order.shippingAddress?.address1}<br />
          {order.postcode || order.shippingAddress?.postalCode} {order.city || order.shippingAddress?.city}
        </p>
      )}
      {isAdmin && (order.billingAddress?.address1 || order.billingName) && (
        <p>
          <strong>Faktureringsadresse:</strong><br />
          {order.billingName && <>{order.billingName}<br /></>}
          {order.billingCompany && <>{order.billingCompany}<br /></>}
          {order.billingAddress?.address1}<br />
          {[order.billingAddress?.postalCode, order.billingAddress?.city].filter(Boolean).join(' ')}
        </p>
      )}
      <div>
        <strong>Produkter:</strong>
        {order.productSummary ? (
          <p>{order.productSummary}</p>
        ) : (
          <ul className="order-products-list">
            {order.products?.map((p, idx) => {
              const href = resolveProductLink(p);
              return (
                <li key={idx} className="order-product-item">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="order-product-link"
                    title="Se produkt på northblomst.dk"
                  >
                    {p.quantity} × {p.name}
                    <span className="order-product-link-icon" aria-hidden="true"> ↗</span>
                  </a>
                  {p.notes && <em className="order-product-notes"> ({p.notes})</em>}
                </li>
              );
            })}
            {(!order.products || order.products.length === 0) && <li>Ingen produkter</li>}
          </ul>
        )}
      </div>

      <div className="order-addons">
        <strong>Tilvalg / Add-ons</strong>
        {order.addOns && order.addOns.length > 0 ? (
          <ul>
            {order.addOns.map((a, idx) => (
              <li key={idx}>
                <strong>{a.label}</strong>
                {a.previousValue && a.previousValue !== a.value ? (
                  <>
                    :{' '}
                    <span className="addon-previous-value" title="Previous value">{a.previousValue}</span>
                    {' → '}
                    <span className="addon-updated-value">{a.value}</span>
                    <span className="addon-updated-badge"> updated</span>
                  </>
                ) : (
                  a.value && `: ${a.value}`
                )}
                {a.quantity > 1 && ` (${a.quantity} stk)`}
                {a.price && ` · ${a.quantity > 1 ? `${a.quantity} × ` : ''}${a.price} ${a.currency || 'DKK'}`}
              </li>
            ))}
          </ul>
        ) : (
          <p>Ingen tilvalg</p>
        )}
      </div>

      <p>
        <strong>Korttekst:</strong><br />
        {cardMessage || 'Ingen korttekst'}
      </p>
      {order.notes ? (
        <p>
          <strong>Bemærkninger:</strong><br />
          {order.notes}
        </p>
      ) : null}

      <div className="order-actions">
        {!isCancelled && (
          <>
            <div className="status-buttons">
              <button disabled={updating} onClick={() => updateStatus('new')}>Ny</button>
              <button disabled={updating} onClick={() => updateStatus('in_production')}>I produktion</button>
              <button disabled={updating} onClick={() => updateStatus('ready')}>Klar til levering</button>
              <button disabled={updating} onClick={() => updateStatus('fulfilled')}>Leveret</button>
            </div>
            <button type="button" onClick={() => setShowEdit(true)} disabled={updating}>Rediger</button>
            <button type="button" className="btn-cancel" onClick={() => setShowCancelConfirm(true)} disabled={updating}>
              Annuller ordre
            </button>
          </>
        )}
        {statusError && <div className="error">{statusError}</div>}
        {trackMessage && <div className="success">{trackMessage}</div>}
        {isAdmin && !isCancelled && (
          <>
            <button
              type="button"
              className="secondary"
              onClick={() => pushToTrack(false)}
              disabled={trackPushLoading || updating}
              title="Send ordre manuelt til Procarry Track (levering)"
            >
              {trackPushLoading ? 'Sender til Track…' : 'Send til Track'}
            </button>
            {order.procarryTrackOrderId && (
              <button
                type="button"
                className="secondary"
                onClick={() => pushToTrack(true)}
                disabled={trackPushLoading || updating}
                title="Send igen med korrekt leveringsadresse (sletter gammel Track-kobling)"
              >
                Send til Track igen
              </button>
            )}
          </>
        )}
        {order.procarryTrackOrderId && (
          <p className="muted">
            Track ID: {order.procarryTrackOrderId}
            {order.trackingUrl ? (
              <>
                {' · '}
                <a href={order.trackingUrl} target="_blank" rel="noreferrer">
                  Sporingslink
                </a>
              </>
            ) : null}
          </p>
        )}
        <button className="primary" onClick={handlePrint} disabled={isCancelled || printLoading}>
          {printLoading ? 'Henter pakkeseddel…' : 'Print pakkeseddel'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => handlePrintCardText(CARD_VARIANTS.normal)}
          disabled={isCancelled || !cardMessage}
          title={cardMessage ? 'Print normalt kort til udskæring' : 'Ingen korttekst på ordren'}
        >
          Print kort (normal)
        </button>
        <button
          type="button"
          className="secondary btn-funeral-card"
          onClick={() => handlePrintCardText(CARD_VARIANTS.funeral)}
          disabled={isCancelled || !cardMessage}
          title={cardMessage ? 'Print begravelseskort (foldes på midten)' : 'Ingen korttekst på ordren'}
        >
          Print kort (begravelse)
        </button>
        {isAdmin && (
          <button
            type="button"
            className="secondary"
            onClick={openInvoiceModal}
            title="Vis eller send faktura med billing-adresse til kunden"
          >
            Faktura
          </button>
        )}
        {isAdmin && order.shopifyOrderId && (
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                const { data } = await axios.get(`${API_BASE}/orders/${order._id}/shopify-admin-url`);
                if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
              } catch (e) {
                console.error(e);
              }
            }}
          >
            Åbn i Shopify (original seddel)
          </button>
        )}
      </div>
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => setShowCancelConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <h3>Annuller ordre?</h3>
            <label>
              Årsag (valgfri)
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="F.eks. Kunde aflyste" />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setShowCancelConfirm(false)}>Fortryd</button>
              <button type="button" className="btn-cancel" onClick={handleCancel} disabled={updating}>
                {updating ? 'Annullerer…' : 'Ja, annuller'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showInvoiceDrawer && (
        <div className="drawer-overlay" onClick={() => setShowInvoiceDrawer(false)}>
          <aside className="invoice-lang-drawer" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="drawer-close" onClick={() => setShowInvoiceDrawer(false)} aria-label="Luk">
              ×
            </button>
            <h3>Faktura / Invoice</h3>
            <p className="drawer-lede">Vælg sprog til print og e-mail.</p>
            <button type="button" className="invoice-lang-option" onClick={() => selectInvoiceLanguage('da')}>
              <span className="invoice-lang-flag">🇩🇰</span>
              <span className="invoice-lang-text">
                <strong>Dansk</strong>
                <small>Til lokale kunder i Danmark</small>
              </span>
            </button>
            <button type="button" className="invoice-lang-option" onClick={() => selectInvoiceLanguage('en')}>
              <span className="invoice-lang-flag">🇬🇧</span>
              <span className="invoice-lang-text">
                <strong>English</strong>
                <small>For international customers</small>
              </span>
            </button>
          </aside>
        </div>
      )}
      {showInvoiceModal && (
        <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-modal-head">
              <h3>{invoiceLang === 'en' ? 'Customer invoice' : 'Kundefaktura'}</h3>
              <span className={`invoice-lang-badge ${invoiceLang}`}>
                {invoiceLang === 'en' ? 'English' : 'Dansk'}
              </span>
            </div>
            <button
              type="button"
              className="btn-link invoice-change-lang"
              onClick={() => {
                setShowInvoiceModal(false);
                setShowInvoiceDrawer(true);
              }}
            >
              ← {invoiceLang === 'en' ? 'Change language' : 'Skift sprog'}
            </button>
            <p className="subtitle">
              {invoiceLang === 'en'
                ? 'Edit billing details (company, VAT, address). Saved on the order and used for print and e-mail.'
                : 'Rediger fakturaoplysninger (firma, CVR/Momsnr., adresse). Gemmes på ordren og bruges ved print og e-mail.'}
            </p>
            <div className="invoice-form-grid">
              <label>
                {invoiceLang === 'en' ? 'Name / contact' : 'Navn / kontaktperson'}
                <input
                  value={invoiceForm.name}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, name: e.target.value })}
                />
              </label>
              <label>
                {invoiceLang === 'en' ? 'Company' : 'Firma'}
                <input
                  value={invoiceForm.company}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, company: e.target.value })}
                  placeholder="f.eks. Arimex UAB"
                />
              </label>
              <label>
                {invoiceLang === 'en' ? 'VAT no.' : 'CVR / Momsnr. / VAT'}
                <input
                  value={invoiceForm.vatNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, vatNumber: e.target.value })}
                  placeholder="f.eks. LT234334610"
                />
              </label>
              <label>
                {invoiceLang === 'en' ? 'Address' : 'Adresse'}
                <input
                  value={invoiceForm.address1}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, address1: e.target.value })}
                />
              </label>
              <label>
                {invoiceLang === 'en' ? 'Address 2' : 'Adresse 2'}
                <input
                  value={invoiceForm.address2}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, address2: e.target.value })}
                />
              </label>
              <div className="invoice-form-row">
                <label>
                  {invoiceLang === 'en' ? 'Postal code' : 'Postnr.'}
                  <input
                    value={invoiceForm.postalCode}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, postalCode: e.target.value })}
                  />
                </label>
                <label>
                  {invoiceLang === 'en' ? 'City' : 'By'}
                  <input
                    value={invoiceForm.city}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, city: e.target.value })}
                  />
                </label>
              </div>
              <label>
                {invoiceLang === 'en' ? 'Country' : 'Land'}
                <input
                  value={invoiceForm.country}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, country: e.target.value })}
                  placeholder="DK"
                />
              </label>
              <label>
                {invoiceLang === 'en' ? 'E-mail (invoice recipient)' : 'E-mail (modtager af faktura)'}
                <input
                  type="email"
                  value={invoiceForm.email}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, email: e.target.value })}
                  placeholder="kunde@firma.dk"
                />
              </label>
              <label>
                {invoiceLang === 'en' ? 'Phone' : 'Telefon'}
                <input
                  value={invoiceForm.phone}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, phone: e.target.value })}
                />
              </label>
            </div>
            {invoiceMessage && (
              <p className={invoiceMessage.includes('sendt') || invoiceMessage.includes('gemt') ? 'delivery-date-msg' : 'error'}>
                {invoiceMessage}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setShowInvoiceModal(false)} disabled={invoiceLoading}>
                {invoiceLang === 'en' ? 'Close' : 'Luk'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleSaveInvoiceOnly} disabled={invoiceLoading}>
                {invoiceLang === 'en' ? 'Save' : 'Gem'}
              </button>
              <button type="button" className="btn-secondary" onClick={handlePrintInvoice} disabled={invoiceLoading}>
                {invoiceLoading ? '…' : invoiceLang === 'en' ? 'View / print' : 'Vis / print'}
              </button>
              <button type="button" className="btn-primary" onClick={handleSendInvoice} disabled={invoiceLoading}>
                {invoiceLoading ? '…' : invoiceLang === 'en' ? 'Send to customer' : 'Send til kunde'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showEdit && (
        <EditOrderModal
          order={order}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setShowEdit(false);
            if (updated) setDisplayOrder(updated);
            onUpdated();
          }}
        />
      )}

      <div className="tracking">
        <h4>Tracking</h4>
        <label>
          Trackingnummer
          <input
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
          />
        </label>
        <label>
          Tracking URL
          <input
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
          />
        </label>
        <button onClick={saveTracking} disabled={updating}>
          Gem tracking
        </button>
      </div>

      {isAdmin && (
        <div className="order-assign">
          <h4>Tildel partner</h4>
          {order.partner && (
            <p className="current-partner">
              Nuværende: <strong>{order.partner?.name}</strong>
              {order.partner?.email && ` (${order.partner.email})`}
            </p>
          )}
          <div className="assign-row">
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="assign-select"
              aria-label="Vælg partner"
            >
              <option value="">Vælg partner</option>
              {partners.map((p) => (
                <option key={p._id} value={String(p._id)}>
                  {p.name} {p.zoneRanges?.length ? `(${p.zoneRanges.join(', ')})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAssign}
              disabled={assigning || !selectedPartnerId}
              className="assign-btn"
            >
              {assigning ? 'Tildeler…' : 'Tildel valgt partner'}
            </button>
          </div>
          {assignMessage && (
            <div className={`assign-toast ${assignMessage === 'Tildelt!' ? 'success' : 'error'}`}>
              {assignMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

