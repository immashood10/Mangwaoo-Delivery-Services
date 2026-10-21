'use client';

import { useState } from 'react';
import { Banknote, MapPin, Smartphone, Trash2 } from 'lucide-react';
import { FINISHED_STATUSES, INCOMING_STATUSES, type SellerOrder } from '@/lib/seller-types';
import { useServerRefresh } from './useServerRefresh';

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-warning',
  CONFIRMED: 'bg-blue-50 text-info',
  PREPARING: 'bg-blue-50 text-info',
  OUT_FOR_DELIVERY: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-success',
  CANCELLED: 'bg-red-50 text-danger',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  WALLET: 'EasyPaisa / JazzCash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
};

// The button that moves an order along, per current status (the API enforces the same steps).
const NEXT_STEP: Record<string, { status: string; label: string }> = {
  PENDING: { status: 'CONFIRMED', label: 'Accept order' },
  CONFIRMED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered' },
};

const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PREPARING'];

const formatStatus = (status: string) => status.replace(/_/g, ' ');

/**
 * Incoming orders (the seller moves each one along or cancels it) or completed orders
 * (delivered / cancelled — the seller can remove them from their own list).
 */
export default function OrdersList({ orders, mode }: { orders: SellerOrder[]; mode: 'incoming' | 'completed' }) {
  const { refresh } = useServerRefresh();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // The page reflects a change at once; the refreshed list from the server then replaces this guess.
  const [source, setSource] = useState(orders);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  if (orders !== source) {
    setSource(orders);
    setStatusOverrides({});
    setRemovedIds([]);
  }

  const shown = (mode === 'incoming' ? INCOMING_STATUSES : FINISHED_STATUSES) as readonly string[];
  const visibleOrders = orders
    .filter((order) => !removedIds.includes(order.id))
    .map((order) => (statusOverrides[order.id] ? { ...order, status: statusOverrides[order.id] } : order))
    .filter((order) => shown.includes(order.status));

  /** Shows the change at once, then confirms it with the server (and undoes it if that fails). */
  const run = async (
    orderId: string,
    request: () => Promise<Response>,
    apply: () => void,
    undo: () => void
  ) => {
    setBusyId(orderId);
    setError('');
    apply();

    try {
      const response = await request();

      if (response.ok) {
        refresh();
      } else {
        undo();
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      undo();
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const moveTo = (order: SellerOrder, status: string) =>
    run(
      order.id,
      () =>
        fetch(`/api/seller/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketplace: order.marketplace, status }),
        }),
      () => setStatusOverrides((current) => ({ ...current, [order.id]: status })),
      () =>
        setStatusOverrides((current) => {
          const rest = { ...current };
          delete rest[order.id];
          return rest;
        })
    );

  const cancel = (order: SellerOrder) => {
    if (!window.confirm(`Cancel order #${order.id.slice(-8).toUpperCase()}? The items go back into stock.`)) return;
    void moveTo(order, 'CANCELLED');
  };

  const remove = (order: SellerOrder) => {
    if (!window.confirm('Remove this order from your list? The customer keeps their order history.')) return;
    void run(
      order.id,
      () => fetch(`/api/seller/orders/${order.id}?marketplace=${order.marketplace}`, { method: 'DELETE' }),
      () => setRemovedIds((current) => [...current, order.id]),
      () => setRemovedIds((current) => current.filter((id) => id !== order.id))
    );
  };

  if (visibleOrders.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
        <p className="text-sm text-brand-gray">
          {mode === 'incoming'
            ? 'No orders to handle right now. Orders customers place for your products will show up here.'
            : 'No completed orders yet. Orders you deliver (or that get cancelled) will be kept here.'}
        </p>
      </div>
    );
  }

  const delivered = visibleOrders.filter((order) => order.status === 'DELIVERED');
  const earned = delivered.reduce((sum, order) => sum + order.totalAmount, 0);

  return (
    <div className="space-y-4">
      {mode === 'completed' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface p-4 shadow-soft">
            <p className="text-xs text-brand-gray">Delivered</p>
            <p className="text-xl font-bold text-ink">{delivered.length}</p>
          </div>
          <div className="rounded-2xl bg-surface p-4 shadow-soft">
            <p className="text-xs text-brand-gray">Earned from delivered orders</p>
            <p className="text-xl font-bold text-accent">PKR {earned.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-surface p-4 shadow-soft">
            <p className="text-xs text-brand-gray">Cancelled</p>
            <p className="text-xl font-bold text-ink">{visibleOrders.length - delivered.length}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {visibleOrders.map((order) => {
        const next = NEXT_STEP[order.status];
        const isBusy = busyId === order.id;

        return (
          <div key={order.id} className="rounded-2xl bg-surface p-5 shadow-soft">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">Order #{order.id.slice(-8).toUpperCase()}</p>
                <p className="text-xs text-brand-gray">
                  {order.customerName} &middot;{' '}
                  <time dateTime={order.createdAt} suppressHydrationWarning>
                    {new Date(order.createdAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  ORDER_STATUS_STYLES[order.status] ?? 'bg-gray-50 text-brand-gray'
                }`}
              >
                {formatStatus(order.status)}
              </span>
            </div>

            <div className="mb-3 flex items-start gap-2 text-xs text-brand-gray">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {order.addressLabel ? <span className="font-semibold text-ink">{order.addressLabel} &middot; </span> : null}
                {order.address}
              </span>
            </div>

            {order.note ? (
              <div className="mb-3 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-warning">
                <span className="font-semibold">Customer note: </span>
                <span className="whitespace-pre-wrap break-words">{order.note}</span>
              </div>
            ) : null}

            <ul className="mb-3 space-y-1 text-sm text-ink">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3">
                  <span>
                    {item.productName} <span className="text-brand-gray">x{item.quantity}</span>
                  </span>
                  <span className="text-brand-gray">PKR {(item.price * item.quantity).toLocaleString()}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-brand-gray">
                {order.paymentMethod === 'CASH_ON_DELIVERY' ? (
                  <Banknote className="h-3.5 w-3.5" />
                ) : (
                  <Smartphone className="h-3.5 w-3.5" />
                )}
                {order.paymentMethod ? (PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod) : 'N/A'}
                {order.paymentStatus ? ` · ${order.paymentStatus}` : ''}
              </span>
              <span className="font-bold text-accent">PKR {order.totalAmount.toLocaleString()}</span>
            </div>

            {mode === 'incoming' ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {next ? (
                  <button
                    type="button"
                    onClick={() => moveTo(order, next.status)}
                    disabled={isBusy}
                    className="rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-5 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBusy ? 'Updating…' : next.label}
                  </button>
                ) : null}
                {CANCELLABLE.includes(order.status) ? (
                  <button
                    type="button"
                    onClick={() => cancel(order)}
                    disabled={isBusy}
                    className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-red-600 hover:text-danger disabled:opacity-60"
                  >
                    Cancel order
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => remove(order)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-red-600 hover:text-danger disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {isBusy ? 'Removing…' : 'Remove from my list'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
