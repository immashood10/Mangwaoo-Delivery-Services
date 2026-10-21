'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Marketplace, PendingCartItem } from '@/lib/seller-types';
import { useServerRefresh } from './useServerRefresh';

/** Items customers have in their carts but haven't ordered. The seller can remove entries they've dealt with. */
export default function PendingCartList({
  marketplace,
  items,
}: {
  marketplace: Marketplace;
  items: PendingCartItem[];
}) {
  const { refresh } = useServerRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Removed entries disappear at once; the refreshed list from the server replaces this guess.
  const [source, setSource] = useState(items);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  if (items !== source) {
    setSource(items);
    setRemovedIds([]);
  }

  const visible = items.filter((item) => !removedIds.includes(item.id));

  const remove = async (ids: string[], request: () => Promise<Response>) => {
    setBusy(true);
    setError('');
    // Hide them straight away; put them back if the server says no.
    setRemovedIds((current) => [...current, ...ids]);

    try {
      const response = await request();

      if (response.ok) {
        refresh();
      } else {
        setRemovedIds((current) => current.filter((id) => !ids.includes(id)));
        setError('Could not remove that. Please try again.');
      }
    } catch {
      setRemovedIds((current) => current.filter((id) => !ids.includes(id)));
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeOne = (item: PendingCartItem) =>
    remove([item.id], () => fetch(`/api/seller/cart-items/${item.id}`, { method: 'DELETE' }));

  const clearAll = () => {
    if (!window.confirm('Remove every entry from this list? Customers keep their carts.')) return;
    void remove(
      visible.map((item) => item.id),
      () => fetch(`/api/seller/cart-items?marketplace=${marketplace}`, { method: 'DELETE' })
    );
  };

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
        <p className="text-sm text-brand-gray">
          No pending carts right now. Items customers add to their cart but haven&apos;t ordered yet will show up here.
        </p>
      </div>
    );
  }

  const customers = new Set(visible.map((item) => item.customerName)).size;

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-gray">
          <span className="font-semibold text-ink">{visible.length}</span> {visible.length === 1 ? 'item' : 'items'} from{' '}
          <span className="font-semibold text-ink">{customers}</span> {customers === 1 ? 'customer' : 'customers'}
        </p>
        <button
          type="button"
          onClick={clearAll}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-red-600 hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <ul className="space-y-2">
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {item.productName} <span className="text-brand-gray">x{item.quantity}</span>
              </p>
              <p className="text-xs text-brand-gray">
                {item.customerName} &middot; PKR {(item.price * item.quantity).toLocaleString()} &middot;{' '}
                <time dateTime={item.updatedAt} suppressHydrationWarning>
                  {new Date(item.updatedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-warning">
                Pending
              </span>
              <button
                type="button"
                onClick={() => removeOne(item)}
                disabled={busy}
                className="rounded-lg border border-gray-200 bg-surface p-1.5 text-ink transition-colors hover:border-red-600 hover:text-danger disabled:opacity-50"
                aria-label={`Remove ${item.productName} from ${item.customerName}'s pending cart`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
