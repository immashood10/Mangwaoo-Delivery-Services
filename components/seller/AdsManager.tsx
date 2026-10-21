'use client';

import { useRef, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Megaphone, Trash2, XCircle } from 'lucide-react';
import AdCard from '@/components/AdCard';
import SidebarAdCard from '@/components/SidebarAdCard';
import StoryAdPreview from '@/components/StoryAdPreview';
import type { AdCardData } from '@/lib/ads';
import {
  AD_PAYMENT,
  AD_PLACEMENTS,
  AD_PLACEMENT_KEYS,
  formatAdDays,
  type AdPlacementKey,
  type AdState,
} from '@/lib/ad-config';
import type { AdRequestRow } from '@/lib/promotions';
import { useServerRefresh } from './useServerRefresh';

const INPUT_CLASS =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-transparent outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100';

// Fixed time zone so the server render and the browser agree on the date.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });

const STATE_STYLES: Record<AdState, { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: 'Waiting for payment check', className: 'bg-yellow-50 text-warning', icon: Clock },
  LIVE: { label: 'Live', className: 'bg-green-50 text-success', icon: CheckCircle2 },
  ENDED: { label: 'Ended', className: 'bg-gray-50 text-brand-gray', icon: CalendarClock },
  REJECTED: { label: 'Declined', className: 'bg-red-50 text-danger', icon: XCircle },
};

/** Pick a product and a spot, pay, and follow every ad request. */
export default function AdsManager({ products, ads }: { products: AdCardData[]; ads: AdRequestRow[] }) {
  const { refresh } = useServerRefresh();
  const formRef = useRef<HTMLFormElement>(null);

  const [placement, setPlacement] = useState<AdPlacementKey>('SIDEBAR');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [paymentRef, setPaymentRef] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const selected = products.find((product) => product.id === productId) ?? null;
  const config = AD_PLACEMENTS[placement];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/seller/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, placement, paymentRef }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not send your ad request. Please try again.');
        return;
      }

      setPaymentRef('');
      setNotice(
        `Request sent. Once we confirm your payment your ad runs for ${formatAdDays(config.durationDays)} — you'll get a notification.`
      );
      refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const withdraw = async (ad: AdRequestRow) => {
    if (!window.confirm(`Withdraw the request for "${ad.productName}"?`)) return;

    setWithdrawingId(ad.id);
    setError('');

    try {
      const response = await fetch(`/api/seller/ads/${ad.id}`, { method: 'DELETE' });

      if (response.ok) {
        refresh();
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'Could not withdraw that request.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setWithdrawingId(null);
    }
  };

  const runAgain = (ad: AdRequestRow) => {
    setPlacement(ad.placement);
    if (products.some((product) => product.id === ad.productId)) setProductId(ad.productId);
    setError('');
    setNotice('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-8">
      <form ref={formRef} onSubmit={handleSubmit} className="max-w-3xl space-y-6 rounded-2xl bg-surface p-6 shadow-soft md:p-8">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-bold text-ink">Run an ad</h2>
        </div>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-ink">1. Where should it run?</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {AD_PLACEMENT_KEYS.map((key) => {
              const option = AD_PLACEMENTS[key];

              return (
                <label
                  key={key}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                    placement === key ? 'border-accent bg-red-50' : 'border-gray-200 hover:border-accent'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-bold text-ink">
                      <input
                        type="radio"
                        name="placement"
                        value={key}
                        checked={placement === key}
                        onChange={() => setPlacement(key)}
                        className="h-4 w-4 border-gray-300 text-accent focus:ring-accent"
                      />
                      {option.label}
                    </span>
                    <span className="rounded-full bg-brand-red-primary px-2.5 py-0.5 text-xs font-bold text-white">
                      Rs {option.priceRs}
                    </span>
                  </span>
                  <span className="text-xs text-brand-gray">{option.description}</span>
                  <span className="text-xs font-semibold text-ink">{formatAdDays(option.durationDays)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="ad-product" className="mb-2 block text-sm font-semibold text-ink">
            2. Which product?
          </label>
          {products.length === 0 ? (
            <p className="rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
              You have no listed products yet. Post a product first, then come back to advertise it.
            </p>
          ) : (
            <select id="ad-product" value={productId} onChange={(event) => setProductId(event.target.value)} className={INPUT_CLASS} required>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — PKR {product.price.toLocaleString()}
                </option>
              ))}
            </select>
          )}
        </div>

        {selected ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">How your ad will look</p>
            <div className="pointer-events-none max-w-[16rem]" aria-hidden="true">
              {placement === 'SIDEBAR' ? (
                <SidebarAdCard ad={selected} />
              ) : placement === 'STORY' ? (
                <StoryAdPreview ad={selected} />
              ) : (
                <AdCard ad={selected} featured />
              )}
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">3. Pay Rs {config.priceRs}</p>
          <div className="mb-3 rounded-xl bg-brand-light p-4 text-sm text-brand-gray">
            <p>
              Send <span className="font-bold text-ink">Rs {config.priceRs}</span> by{' '}
              <span className="font-semibold text-ink">{AD_PAYMENT.method}</span> to{' '}
              <span className="font-bold text-ink">{AD_PAYMENT.accountNumber}</span> ({AD_PAYMENT.accountName}), then enter the
              transaction ID you receive.{' '}
              {`We check the payment and your ad runs for ${formatAdDays(config.durationDays)} from the moment it's approved.`}
            </p>
          </div>
          <label htmlFor="ad-payment-ref" className="mb-2 block text-sm font-semibold text-ink">
            Transaction ID
          </label>
          <input
            id="ad-payment-ref"
            type="text"
            value={paymentRef}
            onChange={(event) => setPaymentRef(event.target.value)}
            placeholder="e.g. 12345678901"
            maxLength={40}
            autoComplete="off"
            className={INPUT_CLASS}
            required
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {notice ? (
          <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-success">
            {notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || products.length === 0}
          className="w-full rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary py-3 font-semibold text-white transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending…' : `Request this ad · Rs ${config.priceRs}`}
        </button>
      </form>

      <section aria-labelledby="your-ads-heading" className="max-w-3xl">
        <h2 id="your-ads-heading" className="mb-4 text-lg font-bold text-ink">
          Your ads
        </h2>

        {ads.length === 0 ? (
          <p className="rounded-2xl bg-surface p-6 text-sm text-brand-gray shadow-soft">
            You haven&apos;t run any ads yet. Your requests and running ads will show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {ads.map((ad) => {
              const style = STATE_STYLES[ad.state];
              const Icon = style.icon;

              return (
                <li key={ad.id} className="rounded-2xl bg-surface p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{ad.productName}</p>
                      <p className="text-xs text-brand-gray">
                        {AD_PLACEMENTS[ad.placement].label} &middot; Rs {ad.amount} &middot; Transaction {ad.paymentRef}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.className}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {style.label}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-brand-gray">
                    {ad.state === 'PENDING' ? (
                      <>Sent on {formatDate(ad.createdAt)}. It goes live as soon as the payment is confirmed.</>
                    ) : ad.state === 'LIVE' && ad.startsAt && ad.endsAt && ad.placement === 'STORY' ? (
                      <>
                        On the logo until <span className="font-semibold text-ink">{formatDateTime(ad.endsAt)}</span>
                        {ad.storyViews !== null ? ` · watched by ${ad.storyViews} ${ad.storyViews === 1 ? 'person' : 'people'}` : ''}
                      </>
                    ) : ad.state === 'LIVE' && ad.startsAt && ad.endsAt ? (
                      <>
                        Running {formatDate(ad.startsAt)} – {formatDate(ad.endsAt)} &middot;{' '}
                        <span className="font-semibold text-ink">
                          {ad.daysLeft} {ad.daysLeft === 1 ? 'day' : 'days'} left
                        </span>
                      </>
                    ) : ad.state === 'ENDED' && ad.endsAt ? (
                      <>
                        Ended on {formatDate(ad.endsAt)}.
                        {ad.storyViews !== null ? ` Watched by ${ad.storyViews} ${ad.storyViews === 1 ? 'person' : 'people'}.` : ''}
                      </>
                    ) : (
                      <>{ad.rejectionReason ? `Reason: ${ad.rejectionReason}` : 'We could not confirm the payment for this request.'}</>
                    )}
                  </p>

                  {ad.state === 'PENDING' || ad.state === 'ENDED' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ad.state === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => withdraw(ad)}
                          disabled={withdrawingId === ad.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-red-600 hover:text-danger disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Withdraw request
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => runAgain(ad)}
                          className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-brand-red-primary hover:text-white"
                        >
                          Run it again
                        </button>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
