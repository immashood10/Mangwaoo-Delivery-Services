'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Banknote, Clock, Flag, MapPin, PackageCheck, PackageX, Percent, Star } from 'lucide-react';
import StarRating from '@/components/StarRating';
import { useRider } from '@/components/rider/RiderShell';
import {
  RIDER_HISTORY_RANGES,
  RIDER_HISTORY_RANGE_LABELS,
  formatRatingAverage,
  type RiderHistoryFilter,
  type RiderHistoryItem,
  type RiderHistoryKind,
  type RiderHistoryRange,
  type RiderHistoryResponse,
} from '@/lib/rider-history-types';
import { formatPkr } from '@/lib/rider-wallet-config';

const KIND_STYLES: Record<RiderHistoryKind, { label: string; className: string }> = {
  PENDING: { label: 'In progress', className: 'bg-amber-50 text-warning' },
  DELIVERED: { label: 'Delivered', className: 'bg-green-50 text-success' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-50 text-danger' },
  CLOSED: { label: 'Closed by Mangwaoo', className: 'bg-gray-100 text-brand-gray' },
};

const CANCELLED_BY_TEXT = {
  RIDER: 'You cancelled this order.',
  CUSTOMER: 'The customer cancelled this order.',
  ADMIN: 'Mangwaoo cancelled this order.',
} as const;

const EMPTY_TEXT: Record<RiderHistoryFilter, string> = {
  all: 'No orders yet. The orders you take will be listed here.',
  delivered: 'No delivered orders in this period.',
  cancelled: 'No cancelled orders in this period.',
  pending: 'You have no order in progress right now.',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' });
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof PackageCheck; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-soft">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xl font-bold text-ink">{value}</span>
        <span className="block text-xs text-brand-gray">{label}</span>
      </span>
    </div>
  );
}

function OrderCard({ item }: { item: RiderHistoryItem }) {
  const kind = KIND_STYLES[item.kind];
  const isPending = item.kind === 'PENDING';

  return (
    <li className="rounded-2xl bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{item.customerName}</p>
          <p className="text-xs text-brand-gray">
            {isPending ? `Taken ${formatWhen(item.takenAt)}` : `${formatWhen(item.takenAt)} → ${formatWhen(item.endedAt ?? item.takenAt)}`}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${kind.className}`}>{kind.label}</span>
      </div>

      <div className="mt-3 space-y-1 text-sm text-brand-gray">
        {item.pickupText ? (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <span className="min-w-0 break-words">{item.pickupText}</span>
          </p>
        ) : null}
        <p className="flex items-start gap-2">
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 break-words">{item.addressText}</span>
        </p>
      </div>

      {item.kind === 'CANCELLED' && item.cancelledBy ? <p className="mt-3 text-xs font-semibold text-danger">{CANCELLED_BY_TEXT[item.cancelledBy]}</p> : null}

      {item.kind === 'DELIVERED' || isPending ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-100 pt-3 text-sm">
          <span className="text-brand-gray">
            Delivery charge{' '}
            <span className="font-bold text-ink">{item.deliveryCharge !== null ? (item.deliveryCharge > 0 ? formatPkr(item.deliveryCharge) : 'None') : '—'}</span>
          </span>
          {item.kind === 'DELIVERED' && item.commission !== null ? (
            <span className="text-brand-gray">
              Mangwaoo&apos;s share <span className="font-bold text-ink">{formatPkr(item.commission)}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {item.kind === 'DELIVERED' ? (
        <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
          {item.stars !== null ? (
            <>
              <p className="flex items-center gap-2">
                <StarRating value={item.stars} />
                <span className="font-semibold text-ink">{item.stars}/5 from the customer</span>
              </p>
              {item.ratingComment ? <p className="mt-1 break-words text-brand-gray">&ldquo;{item.ratingComment}&rdquo;</p> : null}
            </>
          ) : (
            <p className="text-xs text-brand-gray">The customer has not rated this delivery yet.</p>
          )}
        </div>
      ) : null}

      {isPending ? (
        <Link href="/rider/chats" className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
          Open the order chat
        </Link>
      ) : null}
    </li>
  );
}

/** The rider's order history: how many orders they delivered, how many were cancelled, how many are still going, and each of them. */
export default function RiderHistory() {
  const { rider } = useRider();
  const [filter, setFilter] = useState<RiderHistoryFilter>('all');
  const [range, setRange] = useState<RiderHistoryRange>('all');
  const [data, setData] = useState<RiderHistoryResponse | null>(null);
  const [items, setItems] = useState<RiderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  // A slow answer for an older filter must not replace the newer one.
  const requestId = useRef(0);

  const fetchPage = useCallback(async (nextFilter: RiderHistoryFilter, nextRange: RiderHistoryRange, cursor: string | null) => {
    const params = new URLSearchParams({ filter: nextFilter, range: nextRange });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`/api/rider/history?${params}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load your order history.');

    return (await response.json()) as RiderHistoryResponse;
  }, []);

  useEffect(() => {
    if (!rider.isApproved) return;

    const id = ++requestId.current;
    let ignore = false;

    (async () => {
      setIsLoading(true);
      setError('');

      try {
        const page = await fetchPage(filter, range, null);
        if (ignore || id !== requestId.current) return;

        setData(page);
        setItems(page.items);
      } catch (err) {
        if (!ignore && id === requestId.current) setError((err as Error).message || 'Could not load your order history.');
      } finally {
        if (!ignore && id === requestId.current) setIsLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [filter, range, rider.isApproved, fetchPage]);

  const showMore = async () => {
    if (!data?.nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setError('');

    try {
      const page = await fetchPage(filter, range, data.nextCursor);

      setData({ ...page, summary: data.summary, rating: data.rating });
      setItems((current) => [...current, ...page.items]);
    } catch (err) {
      setError((err as Error).message || 'Could not load more orders.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (!rider.isApproved) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
        <Clock className="mx-auto mb-3 h-10 w-10 text-warning" />
        <h1 className="text-xl font-bold text-ink">Order history comes with your approval</h1>
        <p className="mt-2 text-sm text-brand-gray">Once Mangwaoo approves your rider account, every order you take is listed here.</p>
      </div>
    );
  }

  const summary = data?.summary;
  const total = summary ? summary.delivered + summary.cancelled + summary.closed + summary.pending : 0;
  const tabs: { id: RiderHistoryFilter; label: string; count: number | null }[] = [
    { id: 'all', label: 'All', count: summary ? total : null },
    { id: 'delivered', label: 'Delivered', count: summary?.delivered ?? null },
    { id: 'cancelled', label: 'Cancelled', count: summary?.cancelled ?? null },
    { id: 'pending', label: 'Pending', count: summary?.pending ?? null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Order history</h1>
        <p className="mt-1 text-sm text-brand-gray">Every order you took: delivered, cancelled and still going.</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Time period">
        {RIDER_HISTORY_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setRange(option)}
            aria-pressed={range === option}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              range === option ? 'border-accent bg-brand-red-primary text-white' : 'border-gray-200 text-ink hover:border-accent hover:text-accent'
            }`}
          >
            {RIDER_HISTORY_RANGE_LABELS[option]}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Summary">
        <StatCard icon={PackageCheck} label="Delivered" value={summary ? String(summary.delivered) : '…'} tone="bg-green-50 text-success" />
        <StatCard icon={PackageX} label="Cancelled" value={summary ? String(summary.cancelled) : '…'} tone="bg-red-50 text-danger" />
        <StatCard icon={Clock} label="Pending (in progress)" value={summary ? String(summary.pending) : '…'} tone="bg-amber-50 text-warning" />
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-warning">
            <Star className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            {data?.rating ? (
              <>
                <span className="block text-xl font-bold text-ink">{formatRatingAverage(data.rating.average)} / 5</span>
                <span className="block text-xs text-brand-gray">
                  {data.rating.count} {data.rating.count === 1 ? 'rating' : 'ratings'} from customers
                </span>
              </>
            ) : (
              <>
                <span className="block text-xl font-bold text-ink">{data ? '—' : '…'}</span>
                <span className="block text-xs text-brand-gray">No ratings yet</span>
              </>
            )}
          </span>
        </div>
        <StatCard icon={Banknote} label="Delivery charges (delivered)" value={summary ? formatPkr(summary.deliveryCharges) : '…'} tone="bg-brand-red-primary/10 text-accent" />
        <StatCard icon={Percent} label="Mangwaoo's share of them" value={summary ? formatPkr(summary.commission) : '…'} tone="bg-brand-red-primary/10 text-accent" />
      </section>

      {summary && summary.closed > 0 ? (
        <p className="text-xs text-brand-gray">
          {summary.closed} {summary.closed === 1 ? 'order was' : 'orders were'} closed by Mangwaoo without a delivery being confirmed (shown under All).
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3" role="group" aria-label="Order type">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            aria-pressed={filter === tab.id}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              filter === tab.id ? 'bg-brand-dark text-white' : 'bg-surface text-ink shadow-soft hover:text-accent'
            }`}
          >
            {tab.label}
            {tab.count !== null ? (
              <span className={`rounded-full px-2 py-0.5 text-xs ${filter === tab.id ? 'bg-white/20' : 'bg-brand-light text-brand-gray'}`}>{tab.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p role="status" className="rounded-2xl bg-surface p-8 text-center text-sm text-brand-gray shadow-soft">
          Loading your orders…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-sm text-brand-gray shadow-soft">{EMPTY_TEXT[filter]}</p>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((item) => (
              <OrderCard key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </ul>
          {data?.nextCursor ? (
            <div className="text-center">
              <button
                type="button"
                onClick={showMore}
                disabled={isLoadingMore}
                className="rounded-full border border-accent px-6 py-2.5 text-sm font-semibold text-accent hover:bg-brand-red-primary hover:text-white disabled:opacity-60"
              >
                {isLoadingMore ? 'Loading…' : 'Show more orders'}
              </button>
            </div>
          ) : null}
        </>
      )}

      <p className="text-xs text-brand-gray">Orders in progress are always listed, whatever the time period. Times are Karachi time.</p>
    </div>
  );
}
