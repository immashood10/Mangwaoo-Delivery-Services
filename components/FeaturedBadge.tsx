import { Star } from 'lucide-react';

/** The "Featured" label every paid ad carries. */
export default function FeaturedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-brand-red-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm ${className}`}
    >
      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
      Featured
    </span>
  );
}
