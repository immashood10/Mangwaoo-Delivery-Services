import Link from 'next/link';
import { MART_CATEGORIES } from '@/lib/data';
import type { AdCardData } from '@/lib/ads';
import FeaturedBadge from './FeaturedBadge';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  MART_CATEGORIES.map((category) => [category.name, category.icon])
);

/** A seller's paid right-side ad: same look as the other ads in the column, with a Featured label. */
export default function SidebarAdCard({ ad }: { ad: AdCardData }) {
  return (
    <Link
      href={`/mart/${ad.id}`}
      className="block overflow-hidden rounded-2xl border border-accent/40 bg-surface shadow-soft transition-all duration-300 hover:shadow-md"
    >
      <div className="relative flex h-28 w-full items-center justify-center overflow-hidden bg-brand-light">
        {ad.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/products/${ad.id}/image`} alt={ad.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl" aria-hidden="true">
            {CATEGORY_ICONS[ad.category] ?? '🛍️'}
          </span>
        )}
        <FeaturedBadge className="absolute left-2 top-2" />
      </div>
      <div className="p-4">
        <p className="mb-1 line-clamp-2 text-sm font-bold text-ink">{ad.name}</p>
        <p className="mb-1 truncate text-xs text-brand-gray">{ad.storeName}</p>
        <p className="mb-3 text-sm font-bold text-accent">PKR {ad.price.toLocaleString()}</p>
        <span className="inline-flex items-center text-xs font-semibold text-accent hover:underline">View product</span>
      </div>
    </Link>
  );
}
