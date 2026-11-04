'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bike } from 'lucide-react';
import { MAX_FREE_DELIVERY_MIN_ORDER } from '@/lib/delivery';

const INPUT_CLASS =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-transparent outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100 disabled:opacity-50';

/**
 * The restaurant's own free-delivery offer. Off by default: customers pay the delivery fee on every order. Switched on with an
 * amount, an order whose food comes to that much or more (before discounts) is delivered free, and the restaurant's cards and
 * page say so.
 */
export default function FreeDeliveryCard({ freeDeliveryMinOrder }: { freeDeliveryMinOrder: number | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(freeDeliveryMinOrder !== null);
  const [amount, setAmount] = useState(freeDeliveryMinOrder !== null ? String(freeDeliveryMinOrder) : '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const changed = (enabled ? amount.trim() : '') !== (freeDeliveryMinOrder !== null ? String(freeDeliveryMinOrder) : '');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSaving(true);

    try {
      const response = await fetch('/api/seller/free-delivery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ freeDeliveryMinOrder: enabled ? amount.trim() : null }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not save. Please try again.');
        return;
      }

      setMessage(data?.freeDeliveryMinOrder ? `Saved: orders of PKR ${Number(data.freeDeliveryMinOrder).toLocaleString('en-PK')} or more get free delivery.` : 'Saved: customers pay the delivery fee on every order.');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="free-delivery-heading" className="mb-8 rounded-2xl bg-surface p-6 shadow-soft">
      <h2 id="free-delivery-heading" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <Bike className="h-5 w-5 text-accent" />
        Free delivery
      </h2>
      <p className="mb-4 text-sm text-brand-gray">
        Customers pay a delivery fee that depends on how far they are. You can offer free delivery on bigger orders: you choose the amount.
        Free delivery is not given automatically.
      </p>

      <form onSubmit={save} className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            data-testid="free-delivery-toggle"
            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          <span className="text-sm font-semibold text-ink">Offer free delivery on bigger orders</span>
        </label>

        {enabled ? (
          <div>
            <label htmlFor="free-delivery-amount" className="mb-1.5 block text-sm font-semibold text-ink">
              Free delivery when the food comes to (PKR) or more
            </label>
            <input
              id="free-delivery-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_FREE_DELIVERY_MIN_ORDER}
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 500"
              className={INPUT_CLASS}
              required
            />
            <p className="mt-1 text-xs text-brand-gray">
              Counted on the food of one order before any coupon or Loyalty Card discount. The delivery fee you waive is not charged to the customer.
            </p>
          </div>
        ) : (
          <p className="text-xs text-brand-gray">Off: customers pay the delivery fee on every order.</p>
        )}

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm font-medium text-success">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSaving || !changed}
          className="rounded-xl bg-brand-red-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-red-secondary disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </section>
  );
}
