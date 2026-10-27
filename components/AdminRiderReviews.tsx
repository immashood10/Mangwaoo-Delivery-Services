'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Flag, MapPin, MessageSquare, RotateCcw } from 'lucide-react';
import StarRating, { RiderRatingLabel } from '@/components/StarRating';
import type { RiderRatingSummary } from '@/lib/rider-history-types';
import { formatPkr } from '@/lib/rider-wallet-config';

export type RiderReviewRow = {
  /** The order's history line (what the resolve API uses) */
  id: string;
  riderUserId: string;
  riderName: string;
  /** The rider's average rating from all customers */
  riderRating: RiderRatingSummary | null;
  customerName: string;
  stars: number;
  comment: string | null;
  complaint: string | null;
  /** When the complaint was marked as looked into (null: still open) */
  resolvedAt: string | null;
  ratedAt: string;
  pickupText: string | null;
  addressText: string;
  deliveryCharge: number | null;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' });
}

function ReviewCard({ review, isBusy, onResolve }: { review: RiderReviewRow; isBusy: boolean; onResolve: (resolved: boolean) => void }) {
  const hasOpenComplaint = review.complaint !== null && review.resolvedAt === null;

  return (
    <li className={`rounded-2xl border bg-surface p-5 shadow-soft ${hasOpenComplaint ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">
            {review.riderName} <span className="font-normal text-brand-gray">· rider</span>
          </p>
          <RiderRatingLabel rating={review.riderRating} />
        </div>
        <div className="text-right">
          <StarRating value={review.stars} className="h-5 w-5" />
          <p className="mt-0.5 text-xs text-brand-gray">{formatWhen(review.ratedAt)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-brand-gray">
        From <span className="font-semibold text-ink">{review.customerName}</span>
        {review.deliveryCharge !== null && review.deliveryCharge > 0 ? <> · delivery charge {formatPkr(review.deliveryCharge)}</> : null}
      </p>

      <div className="mt-2 space-y-1 text-xs text-brand-gray">
        {review.pickupText ? (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            <span className="min-w-0 break-words">{review.pickupText}</span>
          </p>
        ) : null}
        <p className="flex items-start gap-2">
          <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="min-w-0 break-words">{review.addressText}</span>
        </p>
      </div>

      {review.comment ? <p className="mt-3 break-words text-sm text-ink">&ldquo;{review.comment}&rdquo;</p> : null}

      {review.complaint ? (
        <div className={`mt-3 rounded-xl p-3 text-sm ${hasOpenComplaint ? 'bg-red-50' : 'bg-brand-light'}`}>
          <p className={`mb-1 text-xs font-bold uppercase tracking-wide ${hasOpenComplaint ? 'text-danger' : 'text-brand-gray'}`}>
            {hasOpenComplaint ? 'Complaint · open' : `Complaint · looked into ${review.resolvedAt ? formatWhen(review.resolvedAt) : ''}`}
          </p>
          <p className="whitespace-pre-wrap break-words text-ink">{review.complaint}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/messages?user=${encodeURIComponent(review.riderUserId)}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message the rider
        </Link>
        {review.complaint ? (
          <button
            type="button"
            onClick={() => onResolve(hasOpenComplaint)}
            disabled={isBusy}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
              hasOpenComplaint ? 'bg-brand-red-primary text-white hover:bg-brand-red-secondary' : 'border border-gray-200 text-ink hover:border-accent hover:text-accent'
            }`}
          >
            {hasOpenComplaint ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {isBusy ? 'Saving…' : hasOpenComplaint ? 'Mark as looked into' : 'Open again'}
          </button>
        ) : null}
      </div>
    </li>
  );
}

/** What customers said about their riders: ratings with comments, and complaints for the team to look into. */
export default function AdminRiderReviews({ reviews, emptyText }: { reviews: RiderReviewRow[]; emptyText: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const resolve = async (id: string, resolved: boolean) => {
    setBusyId(id);
    setError('');

    try {
      const response = await fetch(`/api/admin/rider-reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not update this complaint. Please try again.');
        return;
      }

      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-danger">{error}</p> : null}

      {reviews.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-surface p-8 text-center text-sm text-brand-gray">{emptyText}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} isBusy={busyId === review.id} onResolve={(resolved) => resolve(review.id, resolved)} />
          ))}
        </ul>
      )}
    </div>
  );
}
