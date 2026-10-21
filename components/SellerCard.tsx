import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPin, Tag } from 'lucide-react';

/** The seller on an ad page: store name, active ads and location, linking to their store page. */
export default function SellerCard({
  sellerId,
  storeName,
  location,
  memberSince,
  activeAds,
}: {
  sellerId: string;
  storeName: string;
  location: string;
  memberSince: string;
  activeAds: number;
}) {
  return (
    <section aria-labelledby="seller-card-heading" className="rounded-2xl border border-gray-100 bg-surface p-5 shadow-soft">
      <h2 id="seller-card-heading" className="mb-3 text-sm font-bold text-ink">
        Seller
      </h2>

      <Link href={`/store/${sellerId}`} className="group flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-lg font-bold text-accent"
        >
          {storeName.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink group-hover:text-accent">{storeName}</span>
          <span className="block text-xs text-brand-gray">View store profile</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-brand-gray group-hover:text-accent" />
      </Link>

      <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 shrink-0 text-accent" />
          <dt className="text-brand-gray">Active ads:</dt>
          <dd className="font-semibold text-ink">{activeAds}</dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-accent" />
          <dt className="sr-only">Location</dt>
          <dd className="font-semibold text-ink">{location}</dd>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-accent" />
          <dt className="text-brand-gray">Member since</dt>
          <dd className="font-semibold text-ink">{memberSince}</dd>
        </div>
      </dl>

      <Link
        href={`/store/${sellerId}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl border-2 border-accent px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-brand-red-primary hover:text-white"
      >
        See all ads from this seller
      </Link>
    </section>
  );
}
