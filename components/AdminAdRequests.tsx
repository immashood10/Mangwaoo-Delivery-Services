'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy, Megaphone, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { AD_PLACEMENTS, formatAdDays } from '@/lib/ad-config';
import type { AdRequestRow } from '@/lib/promotions';

// Fixed time zone so the server render and the browser agree on the date.
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });

function RequestFacts({ ad }: { ad: AdRequestRow }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-ink">
        <Link href={`/mart/${ad.productId}`} className="hover:text-accent hover:underline">
          {ad.productName}
        </Link>
      </p>
      <p className="text-xs text-brand-gray">
        {ad.storeName} &middot; {ad.ownerEmail}
      </p>
      <p className="mt-1 text-xs text-brand-gray">
        {AD_PLACEMENTS[ad.placement].label} &middot; Rs {ad.amount} &middot; asked{' '}
        <time dateTime={ad.createdAt}>{formatDateTime(ad.createdAt)}</time>
      </p>
      {ad.storyViews !== null && ad.state !== 'PENDING' && ad.state !== 'REJECTED' ? (
        <p className="mt-0.5 text-xs text-brand-gray">
          Story watched by {ad.storyViews} {ad.storyViews === 1 ? 'person' : 'people'}
        </p>
      ) : null}
    </div>
  );
}

/** Review queue for paid ads: check the payment, approve or decline, and end running ads early. */
export default function AdminAdRequests({ ads }: { ads: AdRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // A problem with one row of "Ended and declined", shown right under that row.
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pending = ads.filter((ad) => ad.state === 'PENDING');
  const live = ads.filter((ad) => ad.state === 'LIVE');
  const history = ads.filter((ad) => ad.state === 'ENDED' || ad.state === 'REJECTED');

  const act = async (ad: AdRequestRow, action: 'approve' | 'reject' | 'end') => {
    setBusyId(ad.id);
    setError('');

    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: action === 'reject' ? reason : undefined }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setRejectingId(null);
      setReason('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  /** Sends a change for one ended / declined request; returns the problem to show, or null when it worked. */
  const changeHistoryAd = async (ad: AdRequestRow, init: RequestInit) => {
    setBusyId(ad.id);
    setRowError(null);
    setNotice('');

    try {
      const response = await fetch(`/api/admin/ads/${ad.id}`, init);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setRowError({ id: ad.id, text: data?.error ?? 'Something went wrong. Please try again.' });
        return false;
      }

      router.refresh();
      return true;
    } catch {
      setRowError({ id: ad.id, text: 'Could not reach the server. Please try again.' });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const putBack = async (ad: AdRequestRow) => {
    const days = formatAdDays(AD_PLACEMENTS[ad.placement].durationDays);
    const question =
      ad.state === 'REJECTED'
        ? `Approve the declined request for "${ad.productName}" and run it for ${days} from now?`
        : `Put "${ad.productName}" back on the site for another ${days}, starting now?`;

    if (!window.confirm(question)) return;

    const worked = await changeHistoryAd(ad, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    });

    if (worked) setNotice(`"${ad.productName}" is running again for ${days}. You'll find it under Running now.`);
  };

  const remove = async (ad: AdRequestRow) => {
    if (!window.confirm(`Delete the ${ad.state === 'REJECTED' ? 'declined' : 'ended'} request for "${ad.productName}" from this list? This can't be undone.`)) return;

    await changeHistoryAd(ad, { method: 'DELETE' });
  };

  const copyRef = async (ad: AdRequestRow) => {
    try {
      await navigator.clipboard.writeText(ad.paymentRef);
      setCopiedId(ad.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard blocked: the id is on screen to copy by hand.
    }
  };

  if (ads.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
        <Megaphone className="mx-auto mb-3 h-8 w-8 text-brand-gray" />
        <p className="text-sm text-brand-gray">No ad requests yet. Sellers can request one from Run an ad in their dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {notice ? (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-success">
          {notice}
        </p>
      ) : null}

      <section aria-labelledby="pending-ads-heading">
        <h2 id="pending-ads-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
          Waiting for payment check ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-surface p-5 text-sm text-brand-gray shadow-soft">Nothing waiting.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((ad) => (
              <li key={ad.id} className="rounded-2xl border border-yellow-200 bg-surface p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <RequestFacts ad={ad} />
                  <div className="text-right">
                    <p className="text-xs text-brand-gray">Transaction ID</p>
                    <button
                      type="button"
                      onClick={() => copyRef(ad)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-light px-3 py-1.5 font-mono text-sm font-semibold text-ink hover:text-accent"
                      aria-label={`Copy transaction ID ${ad.paymentRef}`}
                    >
                      {ad.paymentRef}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {copiedId === ad.id ? <p className="mt-1 text-xs text-success">Copied</p> : null}
                  </div>
                </div>

                {rejectingId === ad.id ? (
                  <div className="mt-4 space-y-2">
                    <label htmlFor={`reason-${ad.id}`} className="block text-sm font-semibold text-ink">
                      Reason (the seller sees this)
                    </label>
                    <input
                      id={`reason-${ad.id}`}
                      type="text"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={200}
                      placeholder="e.g. We couldn't find a payment with this transaction ID"
                      className="w-full rounded-xl border border-gray-300 bg-transparent px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-red-100"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => act(ad, 'reject')}
                        disabled={busyId === ad.id}
                        className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {busyId === ad.id ? 'Declining…' : 'Decline request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-ink hover:bg-brand-light"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => act(ad, 'approve')}
                      disabled={busyId === ad.id}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-5 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {busyId === ad.id ? 'Approving…' : `Approve — runs ${formatAdDays(AD_PLACEMENTS[ad.placement].durationDays)}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(ad.id);
                        setReason('');
                      }}
                      disabled={busyId === ad.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2 text-sm font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="live-ads-heading">
        <h2 id="live-ads-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-ink">
          Running now ({live.length})
        </h2>
        {live.length === 0 ? (
          <p className="rounded-2xl bg-surface p-5 text-sm text-brand-gray shadow-soft">No ads are running.</p>
        ) : (
          <ul className="space-y-3">
            {live.map((ad) => (
              <li key={ad.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface p-5 shadow-soft">
                <RequestFacts ad={ad} />
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-success">
                    {ad.placement === 'STORY' && ad.endsAt ? (
                      <>
                        Live &middot; ends <time dateTime={ad.endsAt}>{formatDateTime(ad.endsAt)}</time>
                      </>
                    ) : (
                      <>
                        Live &middot; {ad.daysLeft} {ad.daysLeft === 1 ? 'day' : 'days'} left
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`End the ad for "${ad.productName}" now?`)) void act(ad, 'end');
                    }}
                    disabled={busyId === ad.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
                  >
                    End now
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 ? (
        <section aria-labelledby="past-ads-heading">
          <h2 id="past-ads-heading" className="mb-1 text-sm font-bold uppercase tracking-wide text-ink">
            Ended and declined
          </h2>
          <p className="mb-3 text-xs text-brand-gray">
            Put an ad back to run it again for its full period (7 days, or 1 day for a story ad), or delete it from this list.
          </p>
          <ul className="divide-y divide-gray-100 rounded-2xl bg-surface shadow-soft">
            {history.map((ad) => (
              <li key={ad.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <RequestFacts ad={ad} />
                  {ad.state === 'REJECTED' && ad.rejectionReason ? (
                    <p className="mt-1 text-xs text-danger">Reason: {ad.rejectionReason}</p>
                  ) : null}
                  {ad.state === 'ENDED' && ad.endsAt ? (
                    <p className="mt-1 text-xs text-brand-gray">
                      Ended <time dateTime={ad.endsAt}>{formatDateTime(ad.endsAt)}</time>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      ad.state === 'REJECTED' ? 'bg-red-50 text-danger' : 'bg-gray-50 text-brand-gray'
                    }`}
                  >
                    {ad.state === 'REJECTED' ? 'Declined' : 'Ended'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void putBack(ad)}
                    disabled={busyId === ad.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {busyId === ad.id ? 'Working…' : 'Put back'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(ad)}
                    disabled={busyId === ad.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-red-600 hover:text-danger disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
                {rowError?.id === ad.id ? (
                  <p role="alert" className="basis-full text-xs text-danger">
                    {rowError.text}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
