import Link from 'next/link';
import { MART_CATEGORIES } from '@/lib/data';
import type { AdCardData } from '@/lib/ads';
import FeaturedBadge from './FeaturedBadge';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  MART_CATEGORIES.map((category) => [category.name, category.icon])
);

/** One ad in a grid (related ads, a store's ads, a Featured row). */
export default function AdCard({
  ad,
  showStore = true,
  featured = false,
}: {
  ad: AdCardData;
  showStore?: boolean;
  /** Paid ads carry a "Featured" label. */
  featured?: boolean;
}) {
  // Vehicles get a one-line summary instead of a bare category.
  const meta = ad.vehicle
    ? [ad.vehicle.year, ad.vehicle.condition, ad.vehicle.registrationCity].filter(Boolean).join(' · ')
    : ad.category;

  return (
    <Link
      href={`/mart/${ad.id}`}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-surface shadow-soft transition-all duration-300 hover:shadow-md ${
        featured ? 'border-accent/40' : 'border-gray-100'
      }`}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-brand-light">
        {ad.hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/products/${ad.id}/image`}
            alt={ad.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-5xl" aria-hidden="true">
            {CATEGORY_ICONS[ad.category] ?? '🛍️'}
          </span>
        )}
        {featured ? <FeaturedBadge className="absolute left-2 top-2" /> : null}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="font-bold text-accent">PKR {ad.price.toLocaleString()}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{ad.name}</h3>
        <p className="mt-1 text-xs text-brand-gray">{meta}</p>
        {showStore ? <p className="mt-auto truncate pt-3 text-xs text-brand-gray">{ad.storeName}</p> : null}
      </div>
    </Link>
  );
}
