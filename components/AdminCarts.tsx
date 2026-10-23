'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, Mail, Phone, ShoppingCart, Users } from 'lucide-react';
import type { AdminCartCustomer } from '@/lib/admin-cart-types';
import { formatPkr } from '@/lib/rider-wallet-config';

const ITEMS_SHOWN = 4;

const ago = (changed: string) => (changed === 'just now' ? 'just now' : `${changed} ago`);

function CartCard({
  customer,
  status,
  onRemind,
}: {
  customer: AdminCartCustomer;
  status: 'sending' | 'sent' | undefined;
  onRemind: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? customer.items : customer.items.slice(0, ITEMS_SHOWN);
  // A cart that sat for a day or more is the one worth a nudge: it gets the warm colour.
  const isStale = customer.waitingMs >= 24 * 60 * 60 * 1000;

  return (
    <li className="rounded-2xl border border-gray-100 bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShoppingCart className="h-4 w-4 shrink-0 text-accent" />
            <h3 className="truncate font-bold text-ink">{customer.name}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${isStale ? 'bg-amber-50 text-warning' : 'bg-brand-light text-brand-gray'}`}>
              {customer.waiting === 'just now' ? 'Just now' : `Waiting ${customer.waiting}`}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-brand-gray">
            {customer.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
            ) : null}
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-ink">{formatPkr(Math.round(customer.total))}</p>
          <p className="text-xs text-brand-gray">
            {customer.units} {customer.units === 1 ? 'item' : 'items'} in cart
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-light px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {item.productName} <span className="text-brand-gray">×{item.quantity}</span>
              </p>
              <p className="text-xs text-brand-gray">
                {item.store} · {item.marketplace === 'MART' ? 'MangwaooMart' : 'Food'} · changed {ago(item.changed)}
              </p>
            </div>
            <p className="text-sm font-semibold text-accent">{formatPkr(Math.round(item.price * item.quantity))}</p>
          </li>
        ))}
      </ul>
      {customer.items.length > ITEMS_SHOWN ? (
        <button type="button" onClick={() => setShowAll((current) => !current)} className="mt-2 text-xs font-semibold text-accent hover:underline">
          {showAll ? 'Show fewer' : `Show all ${customer.items.length} lines`}
        </button>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRemind}
          disabled={status !== undefined}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-70"
        >
          {status === 'sent' ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Bell className="h-3.5 w-3.5" />}
          {status === 'sent' ? 'Reminder sent' : status === 'sending' ? 'Sending…' : 'Remind to order'}
        </button>
        <Link
          href={`/admin/users?view=customers&q=${encodeURIComponent(customer.email)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
        >
          <Users className="h-3.5 w-3.5" />
          Open in Users
        </Link>
      </div>
    </li>
  );
}

/** The customers behind the "Still in Cart" page, each with what is waiting and a one-tap reminder. */
export default function AdminCarts({
  customers,
  hidden,
  emptyMessage,
}: {
  customers: AdminCartCustomer[];
  /** Customers who match but aren't listed. */
  hidden: number;
  emptyMessage: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, 'sending' | 'sent'>>({});
  const [error, setError] = useState('');

  const remind = async (customer: AdminCartCustomer) => {
    setError('');
    setStatuses((current) => ({ ...current, [customer.customerId]: 'sending' }));

    const forget = () =>
      setStatuses((current) => {
        const next = { ...current };
        delete next[customer.customerId];

        return next;
      });

    try {
      // The same notification "Send notification" in Users sends, with a link that opens the cart.
      const response = await fetch(`/api/admin/users/${customer.userId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: customer.reminder, href: '/cart' }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        forget();
        setError(data?.error ?? 'Could not send the reminder. Please try again.');
        return;
      }

      setStatuses((current) => ({ ...current, [customer.customerId]: 'sent' }));
    } catch {
      forget();
      setError('Could not reach the server. Please try again.');
    }
  };

  if (customers.length === 0) {
    return <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-10 text-center text-sm text-brand-gray">{emptyMessage}</p>;
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ul className="space-y-4">
        {customers.map((customer) => (
          <CartCard key={customer.customerId} customer={customer} status={statuses[customer.customerId]} onRemind={() => remind(customer)} />
        ))}
      </ul>
      {hidden > 0 ? <p className="mt-4 text-center text-xs text-brand-gray">{hidden} more {hidden === 1 ? 'customer is' : 'customers are'} not shown (the 100 most recent are listed).</p> : null}
    </div>
  );
}
