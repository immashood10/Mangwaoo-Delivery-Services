'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const NEXT: Record<string, { status: string; label: string }> = {
  PENDING: { status: 'CONFIRMED', label: 'Accept order' },
  CONFIRMED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'OUT_FOR_DELIVERY', label: 'Given to rider / on the way' },
  OUT_FOR_DELIVERY: { status: 'DELIVERED', label: 'Mark delivered' },
};
const CANCELLABLE = ['PENDING', 'CONFIRMED', 'PREPARING'];

/**
 * The buttons that move an order to its next step (accept, preparing, given to the rider, delivered) or cancel it. Only admins and
 * Area Sales Managers get these (the vendor's own screens have none): `apiBase` is /api/admin/orders or /api/asm/orders.
 */
export default function OrderStatusButtons({
  apiBase,
  kind,
  id,
  orderRef,
  status,
}: {
  apiBase: string;
  kind: 'MART' | 'GULPLAZA';
  id: string;
  orderRef: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = NEXT[status];
  const canCancel = CANCELLABLE.includes(status);

  if (!next && !canCancel) return null;

  const move = async (target: string) => {
    if (target === 'CANCELLED' && !window.confirm(`Cancel order ${orderRef}? The items go back into stock and the customer and the vendor are told.`)) return;

    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: kind, status: target }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) setError(data?.error ?? 'Could not update this order.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
      router.refresh();
    }
  };

  return (
    <div className="mt-3" data-testid="order-status-buttons">
      <div className="flex flex-wrap items-center gap-2">
        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move(next.status)}
            className="rounded-lg bg-brand-red-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-60"
          >
            {busy ? 'Updating…' : next.label}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void move('CANCELLED')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
          >
            Cancel order
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
