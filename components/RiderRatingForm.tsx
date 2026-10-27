'use client';

import { useState } from 'react';
import { CheckCircle2, Flag, Star } from 'lucide-react';
import StarRating from '@/components/StarRating';
import { MAX_COMPLAINT_LENGTH, MAX_RATING_COMMENT_LENGTH, RATING_LABELS } from '@/lib/rider-history-types';

/**
 * Where a customer rates their rider after the order was delivered: 1 to 5 stars, an optional comment for the rider and,
 * if something went wrong, a complaint that only Mangwaoo's team reads. The rating is kept on the order's history line
 * (`POST /api/rider-ratings`) and can be given once.
 */
export default function RiderRatingForm({
  chatId,
  riderName,
  onRated,
}: {
  chatId: string;
  riderName: string;
  /** Called after the rating was saved, with the stars given. */
  onRated?: (stars: number) => void;
}) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [complaint, setComplaint] = useState('');
  const [isComplaining, setIsComplaining] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ stars: number; complaintSent: boolean } | null>(null);

  const shown = hovered || stars;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (stars < 1) {
      setError('Please choose how many stars you give.');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const response = await fetch('/api/rider-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, stars, comment, complaint: isComplaining ? complaint : '' }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not save your rating. Please try again.');
        return;
      }

      setDone({ stars, complaintSent: Boolean(data?.complaintSent) });
      onRated?.(stars);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-green-100 bg-green-50 p-5 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-success" aria-hidden="true" />
        <p className="mt-2 font-bold text-ink">Thank you for rating {riderName}!</p>
        <div className="mt-2 flex justify-center">
          <StarRating value={done.stars} className="h-6 w-6" />
        </div>
        {done.complaintSent ? <p className="mt-2 text-sm text-brand-gray">Your complaint was sent to Mangwaoo. Our team will look into it.</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-surface p-5 shadow-soft">
      <h2 className="text-lg font-bold text-ink">How was {riderName}&apos;s delivery?</h2>
      <p className="mt-0.5 text-sm text-brand-gray">Your rating helps other customers choose, and it tells the rider how they did.</p>

      <div className="mt-4 flex items-center gap-3">
        <div role="radiogroup" aria-label="Your rating" className="flex gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}: ${RATING_LABELS[value - 1]}`}
              onClick={() => {
                setStars(value);
                setError('');
              }}
              onMouseEnter={() => setHovered(value)}
              className="rounded-md p-0.5 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Star className={`h-9 w-9 ${value <= shown ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} aria-hidden="true" />
            </button>
          ))}
        </div>
        <span className="min-h-5 text-sm font-semibold text-ink" aria-live="polite">
          {shown ? RATING_LABELS[shown - 1] : ''}
        </span>
      </div>

      <label className="mt-4 block text-sm font-semibold text-ink">
        A word for the rider <span className="font-normal text-brand-gray">(optional)</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={MAX_RATING_COMMENT_LENGTH}
          rows={2}
          placeholder="e.g. Quick and polite"
          className="mt-1.5 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
        />
      </label>

      {isComplaining ? (
        <label className="mt-4 block text-sm font-semibold text-ink">
          Your complaint <span className="font-normal text-brand-gray">(only Mangwaoo&apos;s team reads this, not the rider)</span>
          <textarea
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            maxLength={MAX_COMPLAINT_LENGTH}
            rows={4}
            placeholder="Tell us what went wrong…"
            className="mt-1.5 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
          />
          <span className="mt-0.5 block text-right text-xs font-normal text-brand-gray">
            {complaint.length}/{MAX_COMPLAINT_LENGTH}
          </span>
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setIsComplaining(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
        >
          <Flag className="h-4 w-4" aria-hidden="true" />
          Something went wrong? Write a complaint
        </button>
      )}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSending || stars < 1}
        className="mt-4 w-full rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSending ? 'Sending…' : 'Submit rating'}
      </button>
    </form>
  );
}
