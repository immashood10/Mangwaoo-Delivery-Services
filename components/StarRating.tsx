import { Star } from 'lucide-react';
import { formatRatingAverage, type RiderRatingSummary } from '@/lib/rider-history-types';

/** Five stars, filled up to `value` (rounded to a whole star). Only shows a rating, to give one use RiderRatingForm. */
export default function StarRating({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  const filled = Math.round(value);

  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          aria-hidden="true"
          className={`${className} ${position <= filled ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </span>
  );
}

/** "★ 4.8 (23 ratings)" for a rider, or "New rider" while nobody has rated them. */
export function RiderRatingLabel({ rating, className = '' }: { rating: RiderRatingSummary | null | undefined; className?: string }) {
  if (!rating) {
    return <span className={`text-xs font-semibold text-brand-gray ${className}`}>New rider · no ratings yet</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold text-ink ${className}`}>
      <Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      {formatRatingAverage(rating.average)}
      <span className="font-normal text-brand-gray">
        ({rating.count} {rating.count === 1 ? 'rating' : 'ratings'})
      </span>
    </span>
  );
}
