'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, PackageCheck } from 'lucide-react';

type ShopOrder = {
  id: string; ref: string; status: string; storeName: string; customerName: string; address: string;
  riderName: string | null; riderAssigned: boolean; createdAt: string; total: number; items: { name: string; quantity: number }[];
};

const pkr = (value: number) => `PKR ${Math.round(value).toLocaleString('en-IN')}`;
const NEXT: Record<string, { status: string; label: string }> = {
  PENDING: { status: 'CONFIRMED', label: 'Accept order' },
  CONFIRMED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'OUT_FOR_DELIVERY', label: 'Dispatch / on the way' },
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-warning', CONFIRMED: 'bg-blue-50 text-info', PREPARING: 'bg-purple-50 text-accent', OUT_FOR_DELIVERY: 'bg-green-50 text-success',
};

export default function ShopOwnerFulfillmentOrders({ endpoint, heading = 'Shop Owner orders' }: { endpoint: string; heading?: string }) {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Could not load Shop Owner orders.');
      setOrders(data.orders ?? []);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reach the server.');
    } finally {
      setLoaded(true);
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const changeStatus = async (order: ShopOrder, status: string) => {
    if (status === 'CANCELLED' && !window.confirm(`Cancel ${order.ref}? The customer will be notified.`)) return;
    setBusy(order.id);
    setError('');
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(order.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? 'Could not update this order.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reach the server.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-accent" />
        <div>
          <h2 className="font-bold text-ink">{heading}</h2>
          <p className="text-xs text-brand-gray">Mangwaoo fulfillment queue · seller accounts cannot view or update these orders.</p>
        </div>
      </div>
      {error ? <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-danger">{error}</p> : null}
      {!loaded ? <p className="text-sm text-brand-gray">Loading orders…</p> : orders.length === 0 ? <p className="text-sm text-brand-gray">No active Shop Owner orders.</p> : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const next = NEXT[order.status];
            return (
              <li key={order.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{order.ref} · {order.storeName}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLASS[order.status] ?? 'bg-brand-light text-brand-gray'}`}>{order.status.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="mt-1 text-sm text-brand-gray">{order.customerName} · {new Date(order.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Karachi' })}</p>
                    <p className="mt-1 break-words text-xs text-brand-gray">{order.address}</p>
                    <p className="mt-2 text-xs text-ink">{order.items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{pkr(order.total)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-brand-gray"><Bike className="h-3.5 w-3.5" />{order.riderName ?? (order.riderAssigned ? 'Rider assigned' : 'Waiting for rider')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {next ? <button type="button" disabled={busy === order.id || (next.status === 'OUT_FOR_DELIVERY' && !order.riderAssigned)} onClick={() => void changeStatus(order, next.status)} className="rounded-xl bg-brand-dark px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{busy === order.id ? 'Saving…' : next.status === 'OUT_FOR_DELIVERY' && !order.riderAssigned ? 'Assign rider to dispatch' : next.label}</button> : null}
                    {order.status !== 'OUT_FOR_DELIVERY' ? <button type="button" disabled={busy === order.id} onClick={() => void changeStatus(order, 'CANCELLED')} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-50">Cancel</button> : null}
                    {order.status === 'OUT_FOR_DELIVERY' ? <p className="max-w-40 text-right text-xs text-brand-gray">The rider marks this delivered when the customer receives it.</p> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
