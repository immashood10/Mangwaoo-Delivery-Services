'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, CreditCard, Gift, Info, Sparkles, XCircle } from 'lucide-react';
import type { LoyaltyCardPageData } from '@/lib/loyalty-card';
import { formatPkr } from '@/lib/points-config';

const dateOf = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-PK', { ...options, timeZone: 'Asia/Karachi' });

/** The card itself: Mangwaoo red, the number, the holder's name and when they joined. White on the brand colours in both themes. */
function CardVisual({ cardNumber, holderName, since }: { cardNumber: string; holderName: string; since: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-red-primary to-brand-red-secondary p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Mangwaoo</p>
          <p className="text-xl font-extrabold">Loyalty Card</p>
        </div>
        <Sparkles className="h-7 w-7 text-white/80" aria-hidden="true" />
      </div>

      <p className="relative mt-10 font-mono text-lg tracking-[0.18em] sm:text-xl" data-testid="loyalty-card-number">
        {cardNumber}
      </p>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-white/60">Card holder</p>
          <p className="truncate font-semibold uppercase">{holderName}</p>
        </div>
        {since ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-widest text-white/60">Member since</p>
            <p className="font-semibold">{dateOf(since, { month: 'short', year: 'numeric' })}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Mangwaoo Loyalty Card: the progress towards it, applying, the waiting application and, once approved, the card. */
export default function LoyaltyCardView({ data }: { data: LoyaltyCardPageData }) {
  const router = useRouter();
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState('');

  const status = data.card?.status ?? null;
  const remaining = Math.max(0, data.ordersRequired - data.delivered);
  const progress = Math.min(100, Math.round((data.delivered / data.ordersRequired) * 100));

  const apply = async () => {
    setIsApplying(true);
    setError('');

    try {
      const response = await fetch('/api/loyalty-card/apply', { method: 'POST' });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? 'Something went wrong. Please try again.');
        router.refresh();
        return;
      }

      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {!data.enabled ? (
        <p role="note" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <span>The Loyalty Card is paused for now. Cards that were already given stay yours.</span>
        </p>
      ) : null}

      {status === 'APPROVED' && data.card ? (
        <section className="space-y-4">
          <CardVisual cardNumber={data.card.ref} holderName={data.holderName} since={data.card.approvedAt} />
          <div className="rounded-2xl bg-surface p-5 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Your card is active
            </p>
            <p className="mt-2 text-sm text-brand-gray">
              Every order you place gets a surprise Loyalty Card discount. It is taken off your items automatically, and you see it in your cart before you place the order.
            </p>
            <p className="mt-3 text-xs text-brand-gray" data-testid="loyalty-usage">
              {data.usage.checkouts > 0
                ? `Your card has taken ${formatPkr(data.usage.saved)} off ${data.usage.checkouts} ${data.usage.checkouts === 1 ? 'order' : 'orders'} so far.`
                : 'Your first discount is waiting for your next order.'}
            </p>
          </div>
        </section>
      ) : null}

      {status === 'PENDING' ? (
        <section className="rounded-2xl border border-yellow-200 bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 font-bold text-ink">
            <Clock className="h-5 w-5 text-warning" aria-hidden="true" /> Your application is waiting for approval
          </p>
          <p className="mt-2 text-sm text-brand-gray">
            Mangwaoo is looking at it{data.card?.appliedAt ? ` (sent ${dateOf(data.card.appliedAt, { day: 'numeric', month: 'short' })})` : ''}. We will tell you here and in your notifications as soon as it is decided.
          </p>
        </section>
      ) : null}

      {status === 'REVOKED' ? (
        <section className="rounded-2xl border border-red-200 bg-surface p-5 shadow-soft">
          <p className="flex items-center gap-2 font-bold text-ink">
            <XCircle className="h-5 w-5 text-danger" aria-hidden="true" /> Your Loyalty Card was taken back
          </p>
          <p className="mt-2 text-sm text-brand-gray">
            {data.card?.note ? `${data.card.note.replace(/[.!?\s]+$/, '')}. ` : ''}Your orders no longer get the discount. If you think this is a mistake, please contact Mangwaoo Support.
          </p>
        </section>
      ) : null}

      {status !== 'APPROVED' && status !== 'PENDING' && status !== 'REVOKED' ? (
        <section className="rounded-2xl bg-surface p-5 shadow-soft">
          {status === 'REJECTED' ? (
            <p role="note" className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
              Your last application was not approved{data.card?.note ? `: ${data.card.note.replace(/[.!?\s]+$/, '')}` : ''}.
            </p>
          ) : null}

          {data.canApply ? (
            <>
              <p className="flex items-center gap-2 text-lg font-bold text-ink">
                <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
                {status === 'REJECTED' ? 'You can apply again' : 'You can apply for your Loyalty Card!'}
              </p>
              <p className="mt-1 text-sm text-brand-gray">
                You have had {data.delivered} {data.delivered === 1 ? 'order' : 'orders'} delivered. Apply now: Mangwaoo checks your application, and once it is approved every order you place gets a surprise discount.
              </p>
              <button
                type="button"
                onClick={apply}
                disabled={isApplying}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-red-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-red-secondary disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {isApplying ? 'Sending…' : 'Apply for Loyalty Card'}
              </button>
              {error ? (
                <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm text-brand-gray">
                <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" /> Your way to the Loyalty Card
              </p>
              <p className="mt-1 text-3xl font-extrabold text-ink" data-testid="loyalty-progress">
                {data.delivered} <span className="text-base font-semibold text-brand-gray">of {data.ordersRequired} orders delivered</span>
              </p>
              <div className="mt-3" aria-hidden="true">
                <div className="h-2 overflow-hidden rounded-full bg-brand-light">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <p className="mt-2 text-xs text-brand-gray">
                {remaining > 0
                  ? `${remaining} more delivered ${remaining === 1 ? 'order' : 'orders'} and you can apply.`
                  : 'Applications are paused for now.'}
              </p>
            </>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-lg font-bold text-ink">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-brand-gray">
          <li>
            After <span className="font-semibold text-ink">{data.ordersRequired} delivered orders</span> you can apply for the Mangwaoo Loyalty Card.
          </li>
          <li>Mangwaoo checks your application and approves your card.</li>
          <li>
            From then on <span className="font-semibold text-ink">every order you place gets a surprise discount</span>, taken off your items automatically.
          </li>
        </ul>
      </section>
    </div>
  );
}
