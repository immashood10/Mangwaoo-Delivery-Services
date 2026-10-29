'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Bike, Check, ChefHat, Clock, MapPin, MessageCircle, Navigation, Package, PackageCheck, WifiOff, X } from 'lucide-react';
import LiveMap, { type MapLine, type MapMarker } from '@/components/LiveMap';
import { RiderRatingLabel } from '@/components/StarRating';
import { formatDistance } from '@/lib/geo';
import { enableNotificationSound, playNotificationSound } from '@/lib/notification-sound';
import {
  LOCATION_STALE_SECONDS,
  TRACKING_POLL_MS,
  type OrderTracking,
  type TrackStep,
  type TrackStatus,
} from '@/lib/order-tracking-config';

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  WALLET: 'EasyPaisa / JazzCash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
};

const pkr = (amount: number) => `PKR ${amount.toLocaleString('en-PK')}`;

// Times are always shown in Karachi time, with a fixed locale, so the server's and the browser's text are the same.
function formatStepTime(iso: string, todayIso: string) {
  const options = { timeZone: 'Asia/Karachi' } as const;
  const sameDay = new Date(iso).toLocaleDateString('en-US', options) === new Date(todayIso).toLocaleDateString('en-US', options);

  return sameDay
    ? new Date(iso).toLocaleTimeString('en-US', { ...options, hour: 'numeric', minute: '2-digit' })
    : new Date(iso).toLocaleString('en-US', { ...options, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatAgo(seconds: number) {
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${Math.round(seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;

  return `${Math.round(seconds / 3600)} h ago`;
}

function StatusIcon({ status, kind, className }: { status: TrackStatus; kind: OrderTracking['marketplace']; className: string }) {
  switch (status) {
    case 'PENDING':
      return <Clock className={className} aria-hidden="true" />;
    case 'CONFIRMED':
      return <Check className={className} aria-hidden="true" />;
    case 'PREPARING':
      return kind === 'gulplaza' ? <ChefHat className={className} aria-hidden="true" /> : <Package className={className} aria-hidden="true" />;
    case 'OUT_FOR_DELIVERY':
      return <Bike className={className} aria-hidden="true" />;
    case 'DELIVERED':
      return <PackageCheck className={className} aria-hidden="true" />;
    default:
      return <X className={className} aria-hidden="true" />;
  }
}

function Timeline({ steps, todayIso }: { steps: TrackStep[]; todayIso: string }) {
  return (
    <ol className="relative" aria-label="Order progress">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const reached = step.state === 'done' || step.state === 'current';
        const dot =
          step.state === 'done'
            ? 'bg-green-500 text-white'
            : step.state === 'current'
              ? 'bg-brand-red-primary text-white ring-4 ring-brand-red-primary/20'
              : step.state === 'cancelled'
                ? 'bg-red-500 text-white'
                : 'border border-gray-300 bg-brand-light text-transparent';

        return (
          <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0" aria-current={step.state === 'current' ? 'step' : undefined}>
            {!isLast ? (
              <span aria-hidden="true" className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${step.state === 'done' ? 'bg-green-500' : 'bg-gray-200'}`} />
            ) : null}
            <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dot}`}>
              {step.state === 'done' ? <Check className="h-4 w-4" /> : step.state === 'cancelled' ? <X className="h-4 w-4" /> : step.state === 'current' ? <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={`text-sm font-semibold ${reached || step.state === 'cancelled' ? 'text-ink' : 'text-brand-gray'}`}>{step.label}</p>
                {step.at ? <p className="text-xs text-brand-gray">{formatStepTime(step.at, todayIso)}</p> : null}
              </div>
              {reached || step.state === 'cancelled' ? <p className="text-xs text-brand-gray">{step.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Follow one order: where it is (a timeline), a live map with the rider once they have taken it, how long they will be, and the
 * order itself. The page keeps itself up to date: it asks /api/track/[ref] every few seconds while it is open and the order is
 * still going, and rests while the tab is hidden.
 */
export default function OrderTracker({ initial }: { initial: OrderTracking }) {
  const ref = initial.ref;
  const [tracking, setTracking] = useState(initial);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [connection, setConnection] = useState<'live' | 'retrying' | 'stopped'>('live');
  const lastStatus = useRef(initial.status);
  const live = tracking.isLive;
  const { rider } = tracking;

  useEffect(() => {
    enableNotificationSound();
  }, []);

  useEffect(() => {
    if (!live) return;

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      timer = undefined;

      if (document.visibilityState === 'visible') {
        try {
          const response = await fetch(`/api/track/${encodeURIComponent(ref)}`, { cache: 'no-store' });

          if (cancelled) return;

          if (response.ok) {
            const next = (await response.json()) as OrderTracking;

            if (cancelled) return;

            setTracking(next);
            setReceivedAt(Date.now());
            setConnection('live');
          } else if (response.status === 401 || response.status === 404) {
            // Logged out, or the order is gone: asking again would not change the answer.
            setConnection('stopped');

            return;
          } else {
            setConnection('retrying');
          }
        } catch {
          if (!cancelled) setConnection('retrying');
        }
      }

      if (!cancelled) timer = window.setTimeout(poll, TRACKING_POLL_MS);
    };

    // Coming back to the tab asks at once instead of showing what was true minutes ago.
    const wake = () => {
      if (document.visibilityState === 'visible' && timer !== undefined) {
        window.clearTimeout(timer);
        void poll();
      }
    };

    timer = window.setTimeout(poll, TRACKING_POLL_MS);
    document.addEventListener('visibilitychange', wake);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [ref, live]);

  // "Updated 12 s ago" counts up between answers.
  useEffect(() => {
    if (!live) return;

    const tick = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(tick);
  }, [live]);

  // A chime when the order moves on while the page is open (it plays once the visitor has touched the page).
  useEffect(() => {
    if (lastStatus.current !== tracking.status) {
      lastStatus.current = tracking.status;
      playNotificationSound();
    }
  }, [tracking.status]);

  const delivered = tracking.status === 'DELIVERED';
  const cancelled = tracking.status === 'CANCELLED';
  const location = rider.location;
  const ageSeconds = location ? location.ageSeconds + Math.max(0, Math.round((now - receivedAt) / 1000)) : null;
  const stale = location ? location.stale || (ageSeconds ?? 0) > LOCATION_STALE_SECONDS : false;

  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  const { store, dropOff } = tracking;

  if (live) {
    if (store.coords) markers.push({ id: 'store', kind: 'store', point: store.coords, label: store.name });
    if (dropOff.coords) markers.push({ id: 'customer', kind: 'customer', point: dropOff.coords, label: 'You' });
    if (store.coords && dropOff.coords) lines.push({ id: 'plan', from: store.coords, to: dropOff.coords, style: 'plan' });

    if (rider.state === 'ASSIGNED' && location) {
      const riderPoint = { lat: location.lat, lng: location.lng };
      const heading = rider.target === 'CUSTOMER' ? dropOff.coords : rider.target === 'STORE' ? store.coords : null;

      markers.push({ id: 'rider', kind: 'rider', point: riderPoint, label: rider.name ?? 'Your rider', faded: stale });
      if (heading && !stale) lines.push({ id: 'route', from: riderPoint, to: heading, style: 'route' });
    }
  }

  const showMap = live && markers.length >= 2;
  const headingName = rider.target === 'STORE' ? store.name : 'you';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/account" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          My orders
        </Link>
        {live ? (
          connection === 'live' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          ) : connection === 'retrying' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-warning">
              <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
              Reconnecting…
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-brand-gray">Updates paused · refresh the page</span>
          )
        ) : null}
      </div>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="rounded-2xl bg-surface p-5 shadow-soft">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-gray">
          Order {tracking.ref} · {tracking.marketplace === 'mart' ? 'MangwaooMart' : 'Food'} · {store.name}
        </p>
        <div className="flex items-start gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              delivered ? 'bg-green-100 text-success' : cancelled ? 'bg-red-50 text-danger' : 'bg-brand-red-primary/10 text-accent'
            }`}
          >
            <StatusIcon status={tracking.status} kind={tracking.marketplace} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-snug text-ink md:text-2xl" data-testid="track-headline">
              {tracking.headline}
            </h1>
            <p className="mt-1 text-sm text-brand-gray" data-testid="track-subline">
              {tracking.subline}
            </p>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">
          {tracking.headline}. {tracking.subline}
        </p>
      </motion.section>

      {showMap ? (
        <section className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-soft" aria-label="Live map">
          <LiveMap markers={markers} lines={lines} className="h-72 w-full md:h-96" />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-xs" data-testid="track-map-status">
            {rider.state === 'ASSIGNED' ? (
              location ? (
                stale ? (
                  <p className="font-semibold text-warning">
                    {rider.name ?? 'Your rider'}&apos;s last known position · {formatAgo(ageSeconds ?? location.ageSeconds)}
                  </p>
                ) : (
                  <p className="font-semibold text-ink">
                    {rider.distanceKm !== null ? `${formatDistance(rider.distanceKm)} from ${headingName}` : `${rider.name ?? 'Your rider'} is live`}
                    <span className="font-normal text-brand-gray"> · updated {formatAgo(ageSeconds ?? location.ageSeconds)}</span>
                  </p>
                )
              ) : (
                <p className="text-brand-gray">Waiting for {rider.name ?? 'your rider'}&apos;s live location…</p>
              )
            ) : (
              <p className="text-brand-gray">The map follows your rider as soon as one takes your order.</p>
            )}
            {location ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                <Navigation className="h-3 w-3" aria-hidden="true" />
                Open in Google Maps
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      {live && rider.state !== 'NONE' ? (
        <section className="mt-4 rounded-2xl bg-surface p-4 shadow-soft" aria-label="Your rider" data-testid="track-rider">
          {rider.state === 'SEARCHING' ? (
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-red-primary/15" />
                <Bike className="relative h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">{rider.managed ? 'Your area manager is picking a rider…' : 'Finding a rider near you…'}</p>
                <p className="text-xs text-brand-gray">
                  {rider.managed ? 'Your rider will show up here as soon as one is assigned.' : 'The first rider to accept will show up here.'}
                </p>
              </div>
              {rider.chatId ? (
                <Link href={`/finding-rider/${rider.chatId}`} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                  Order chat
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-lg font-bold text-accent">
                {(rider.name ?? 'R').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{rider.name}</p>
                <div className="flex flex-wrap items-center gap-x-2">
                  <RiderRatingLabel rating={rider.rating} />
                  {rider.vehicle ? <span className="text-xs capitalize text-brand-gray">· {rider.vehicle}</span> : null}
                </div>
              </div>
              {rider.chatId ? (
                <Link
                  href={`/finding-rider/${rider.chatId}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-accent px-3 py-2 text-xs font-semibold text-accent transition hover:bg-brand-red-primary hover:text-white"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Chat
                </Link>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl bg-surface p-5 shadow-soft" aria-label="Order progress">
        <h2 className="mb-4 text-sm font-bold text-ink">Order progress</h2>
        <Timeline steps={tracking.steps} todayIso={tracking.serverTime} />
      </section>

      <section className="mt-4 rounded-2xl bg-surface p-5 shadow-soft" aria-label="Order details">
        <h2 className="mb-3 text-sm font-bold text-ink">Order details</h2>
        <ul className="space-y-1 text-sm text-ink">
          {tracking.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                {item.name} <span className="text-brand-gray">x{item.quantity}</span>
              </span>
              <span className="shrink-0 text-brand-gray">{pkr(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-0.5 border-t border-gray-100 pt-3 text-xs text-brand-gray">
          <p className="flex justify-between">
            <span>Items</span>
            <span>{pkr(tracking.money.items)}</span>
          </p>
          {tracking.money.discount > 0 ? (
            <p className="flex justify-between text-success">
              <span>Discount</span>
              <span>− {pkr(tracking.money.discount)}</span>
            </p>
          ) : null}
          {tracking.money.delivery > 0 ? (
            <p className="flex justify-between">
              <span>Delivery</span>
              <span>+ {pkr(tracking.money.delivery)}</span>
            </p>
          ) : null}
          <p className="flex justify-between pt-1 text-sm font-bold text-ink">
            <span>Total</span>
            <span className="text-accent">{pkr(tracking.money.total)}</span>
          </p>
          <p className="pt-1">
            {tracking.payment.method ? (PAYMENT_LABELS[tracking.payment.method] ?? tracking.payment.method) : 'Payment'}
            {tracking.payment.status ? ` · ${tracking.payment.status}` : ''}
          </p>
        </div>

        <div className="mt-3 flex items-start gap-2 border-t border-gray-100 pt-3 text-xs text-brand-gray">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{dropOff.text}</span>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/gulplaza" className="font-semibold text-accent hover:underline">
          Order more food
        </Link>
        <span className="text-gray-300">·</span>
        <Link href="/account" className="font-semibold text-accent hover:underline">
          My orders
        </Link>
      </div>
    </div>
  );
}
