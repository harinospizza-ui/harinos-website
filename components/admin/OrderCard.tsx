import React, { useMemo, useState } from 'react';
import { AdminRole, Order, OrderStatus, OutletConfig } from '../../types';
import { StorageService } from '../../services/storage';
import { deleteSharedOrder } from '../../services/orderApi';

interface OrderCardProps {
  order: Order;
  role: AdminRole;
  outlet?: OutletConfig;
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void;
  defaultExpanded?: boolean;
  showOutletName?: boolean;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  done: 'Done',
  cancelled: 'Cancelled',
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
  new: 'bg-red-900 text-red-300',
  preparing: 'bg-amber-900 text-amber-300',
  ready: 'bg-blue-900 text-blue-300',
  out_for_delivery: 'bg-purple-900 text-purple-300',
  done: 'bg-green-900 text-green-300',
  cancelled: 'bg-slate-700 text-slate-400 line-through',
};

const TYPE_CLASSES = {
  delivery: 'bg-red-600 text-white',
  takeaway: 'bg-blue-600 text-white',
  dinein: 'bg-green-600 text-white',
};

const getOrderTime = (order: Order): Date => new Date(order.receivedAt ?? order.date);

export const formatRelativeTime = (value?: string): string => {
  if (!value) {
    return 'just now';
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day ago`;
};

export const getNextStatus = (order: Order): OrderStatus | null => {
  const status = order.status ?? 'new';
  if (status === 'new') return 'preparing';
  if (status === 'preparing') return order.orderType === 'delivery' ? 'out_for_delivery' : 'ready';
  if (status === 'ready' || status === 'out_for_delivery') return 'done';
  return null;
};

const getNextStatusLabel = (status: OrderStatus): string => {
  if (status === 'preparing') return 'Start Preparing';
  if (status === 'ready') return 'Mark Ready';
  if (status === 'out_for_delivery') return 'Out for Delivery';
  if (status === 'done') return 'Mark Done';
  return STATUS_LABELS[status];
};

const buildGoogleMapsRouteUrl = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): string => `https://www.google.com/maps/dir/${fromLat},${fromLng}/${toLat},${toLng}`;

const normalizePhoneForWhatsApp = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const generatePOSReceiptHTML = (order: Order, outlet: OutletConfig): string => {
  const subtotal = order.items.reduce((sum, item) => sum + item.totalPrice, 0);
  const date = new Date(order.receivedAt ?? order.date);
  const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const itemRows = order.items.map((item) => `
    <div class="${item.isOfferBonus ? 'item-row item-free' : 'item-row'}">
      <span class="item-name">${item.quantity}x ${escapeHtml(item.name)}${item.selectedSize ? ` [${escapeHtml(item.selectedSize)}]` : ''}</span>
      <span class="item-price">${item.isOfferBonus ? 'FREE' : `Rs ${Math.round(item.totalPrice)}`}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${escapeHtml(order.id)}</title>
  <style>
    /* NOTE: 58mm POS thermal receipt format. */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.4;
      color: #000;
      background: #fff;
      width: 58mm;
      padding: 4mm 4mm;
    }
    .logo-block { text-align: center; margin-bottom: 4px; }
    .logo-img {
      width: 28mm;
      height: auto;
      display: block;
      margin: 0 auto 3px;
      filter: grayscale(1) contrast(1.5);
    }
    .brand-name { font-size: 16px; font-weight: 900; letter-spacing: 0.15em; text-transform: uppercase; }
    .outlet-name { font-size: 10px; font-weight: bold; }
    .outlet-sub { font-size: 9px; color: #444; }
    .dash { border-top: 1px dashed #000; margin: 4px 0; }
    .solid { border-top: 1px solid #000; margin: 4px 0; }
    .double { border-top: 3px double #000; margin: 4px 0; }
    .row { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
    .order-id { font-size: 13px; font-weight: 900; text-align: center; letter-spacing: 0.05em; margin: 3px 0; }
    .type-badge { display: inline-block; border: 1px solid #000; padding: 0 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; }
    .item-row { display: flex; justify-content: space-between; font-size: 10px; margin: 2px 0; }
    .item-name { flex: 1; padding-right: 4px; word-break: break-word; }
    .item-price { white-space: nowrap; font-weight: bold; }
    .item-free { font-size: 9px; font-style: italic; color: #444; }
    .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin: 3px 0; }
    .footer { text-align: center; font-size: 9px; color: #444; margin-top: 4px; }
    .footer .website { font-size: 10px; font-weight: bold; color: #000; }
    @media print {
      body { width: 58mm; }
      @page { size: 58mm auto; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="logo-block">
    <img src="/icon-192.png" alt="Harino's" class="logo-img" />
    <div class="brand-name">Harino's</div>
    <div class="outlet-name">${escapeHtml(outlet.name)}</div>
    <div class="outlet-sub">${escapeHtml(outlet.address ?? '')}</div>
    <div class="outlet-sub">${escapeHtml(outlet.phone)}</div>
  </div>
  <div class="solid"></div>
  <div class="order-id">#${escapeHtml(order.id)}</div>
  <div style="text-align:center; margin-bottom:3px;"><span class="type-badge">${escapeHtml(order.orderType)}</span></div>
  <div class="row"><span>Date</span><span>${dateStr}</span></div>
  <div class="row"><span>Time</span><span>${timeStr}</span></div>
  ${order.customerPhone ? `<div class="row"><span>Customer</span><span>${escapeHtml(order.customerPhone)}</span></div>` : ''}
  ${order.orderType === 'delivery' && order.customerAddress ? `<div style="font-size:9px; margin-top:2px; word-break:break-word;">${escapeHtml(order.customerAddress)}</div>` : ''}
  ${order.orderType === 'delivery' && order.distanceKm ? `<div class="row"><span>Distance</span><span>${order.distanceKm.toFixed(1)} km</span></div>` : ''}
  <div class="dash"></div>
  ${itemRows}
  <div class="dash"></div>
  <div class="row"><span>Subtotal</span><span>Rs ${Math.round(subtotal)}</span></div>
  ${(order.deliveryFee ?? 0) > 0 ? `<div class="row"><span>Delivery Fee</span><span>Rs ${Math.round(order.deliveryFee ?? 0)}</span></div>` : ''}
  <div class="double"></div>
  <div class="total-row"><span>TOTAL</span><span>Rs ${Math.round(order.total)}</span></div>
  <div class="double"></div>
  <div class="footer">
    <div>Thank you for your order!</div>
    <div class="website">harinos.in</div>
    <div style="margin-top:2px; font-size:8px; color:#666;">Powered by Harino's POS</div>
  </div>
</body>
</html>`;
};

const printReceipt = (order: Order, outlet: OutletConfig): void => {
  const printWindow = window.open('', '_blank', 'width=300,height=700');
  if (!printWindow) return;
  printWindow.document.write(generatePOSReceiptHTML(order, outlet));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 300);
};

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  role,
  outlet,
  onStatusChange,
  defaultExpanded = false,
  showOutletName = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const status = order.status ?? 'new';
  const nextStatus = getNextStatus(order);
  const resolvedOutlet = outlet ?? StorageService.getMergedOutlets().find((item) => item.id === order.outletId);
  const customerWhatsAppUrl = order.customerPhone
    ? `https://wa.me/${normalizePhoneForWhatsApp(order.customerPhone)}?text=${encodeURIComponent(`Hello from Harino's. We are contacting you about order #${order.id}.`)}`
    : null;
  const routeUrl = resolvedOutlet && order.customerLatitude !== undefined && order.customerLongitude !== undefined
    ? buildGoogleMapsRouteUrl(
        resolvedOutlet.latitude,
        resolvedOutlet.longitude,
        order.customerLatitude,
        order.customerLongitude,
      )
    : null;
  const subtotal = useMemo(
    () => order.items.reduce((sum, item) => sum + item.totalPrice, 0),
    [order.items],
  );
  const gst = subtotal - subtotal / 1.05;

  const handleDelete = () => {
    if (!order.outletId || !window.confirm(`Delete order ${order.id}?`)) {
      return;
    }

    StorageService.deleteOrder(order.outletId, order.id);
    void deleteSharedOrder(order.id).catch(() => undefined);
    try {
      const channel = new BroadcastChannel('harinos_orders');
      channel.postMessage({ type: 'ORDER_DELETED', outletId: order.outletId, orderId: order.id });
      channel.close();
    } catch {
      // Polling will refresh the list if BroadcastChannel is unavailable.
    }
  };

  return (
    <article
      className={`mb-3 rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-200 shadow-xl transition-all duration-200 ${
        status === 'cancelled' ? 'opacity-70' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <div className="text-xl font-black text-white">#{order.id}</div>
          <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {showOutletName && order.outletName ? `${order.outletName} - ` : ''}{formatRelativeTime(getOrderTime(order).toISOString())}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${TYPE_CLASSES[order.orderType]}`}>
            {order.orderType}
          </span>
          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${STATUS_CLASSES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-300">
            Rs {Math.round(order.total)}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">
          <section className="grid gap-2 text-sm text-slate-300">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Customer</div>
            <div>
              Phone:{' '}
              {order.customerPhone ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <a className="font-bold text-white underline decoration-red-500/50" href={`tel:${order.customerPhone}`}>
                    {order.customerPhone}
                  </a>
                  {customerWhatsAppUrl && (
                    <a className="rounded-lg bg-green-700 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white" href={customerWhatsAppUrl} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  )}
                </span>
              ) : (
                <span className="text-slate-500">Not captured</span>
              )}
            </div>
            <div>
              Location:{' '}
              {order.orderType === 'delivery' && order.customerLocationUrl ? (
                <a className="font-bold text-red-300 underline" href={routeUrl ?? order.customerLocationUrl} target="_blank" rel="noreferrer">
                  Navigate to customer
                </a>
              ) : (
                <span className="text-slate-500">-</span>
              )}
            </div>
            {order.customerAddress && <div className="leading-5 text-slate-400">{order.customerAddress}</div>}
            <div>Road distance: {order.distanceKm ? `${order.distanceKm.toFixed(1)} km` : '-'}</div>
          </section>

          <section>
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Items</div>
            <div className="space-y-2">
              {order.items.map((item, index) => (
                <div key={`${item.id}-${item.selectedSize ?? 'default'}-${index}`} className="flex justify-between gap-3 text-sm">
                  <span className={item.isOfferBonus ? 'italic text-amber-300' : 'text-slate-200'}>
                    {item.quantity}x {item.name}
                    {item.selectedSize ? ` [${item.selectedSize}]` : ''}
                    {item.isOfferBonus ? ' (FREE)' : ''}
                  </span>
                  <span className="font-bold text-white">Rs {Math.round(item.totalPrice)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-3 text-sm">
            <div>Subtotal</div>
            <div className="text-right font-bold">Rs {Math.round(subtotal)}</div>
            <div>Delivery</div>
            <div className="text-right font-bold">Rs {Math.round(order.deliveryFee ?? 0)}</div>
            <div>GST incl.</div>
            <div className="text-right font-bold">Rs {gst.toFixed(2)}</div>
            <div className="text-lg font-black text-white">Total</div>
            <div className="text-right text-lg font-black text-red-300">Rs {Math.round(order.total)}</div>
          </section>

          <section>
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Timeline</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(order.statusHistory ?? []).map((event, index) => (
                <div key={`${event.status}-${event.timestamp}-${index}`} className="min-w-36 rounded-xl bg-slate-900 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-white">
                    {STATUS_LABELS[event.status]}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-slate-400">{event.changedBy}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            {nextStatus && onStatusChange && (
              <button
                type="button"
                onClick={() => onStatusChange(order.id, nextStatus)}
                className="rounded-xl bg-red-600 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all duration-200 active:scale-95"
              >
                {getNextStatusLabel(nextStatus)}
              </button>
            )}
            {role !== 'staff' && onStatusChange && status !== 'done' && status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => onStatusChange(order.id, 'cancelled')}
                className="rounded-xl border border-slate-600 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 transition-all duration-200 active:scale-95"
              >
                Cancel
              </button>
            )}
            {role !== 'staff' && resolvedOutlet && (
              <button
                type="button"
                onClick={() => printReceipt(order, resolvedOutlet)}
                className="rounded-xl border border-slate-600 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-300 transition-all duration-200 active:scale-95"
              >
                Print Bill
              </button>
            )}
            {order.orderType === 'delivery' && routeUrl && (
              <a
                href={routeUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-red-600 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all duration-200 active:scale-95"
              >
                Navigate
              </a>
            )}
            {customerWhatsAppUrl && (
              <a
                href={customerWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-green-700 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all duration-200 active:scale-95"
              >
                Internet Contact
              </a>
            )}
            {role === 'admin' && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border border-red-900 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-red-300 transition-all duration-200 active:scale-95"
              >
                Delete Order
              </button>
            )}
          </section>
        </div>
      )}
    </article>
  );
};

export default OrderCard;
