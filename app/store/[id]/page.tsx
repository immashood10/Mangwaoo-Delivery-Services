import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Tag } from 'lucide-react';
import { formatMonthYear, getSellerAds, getStore } from '@/lib/ads';
import { formatLocation } from '@/lib/locations';
import AdCard from '@/components/AdCard';
import ChatWidget from '@/components/ChatWidget';
import ShareButton from '@/components/ShareButton';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const store = await getStore(id);

  if (!store) return {};

  return {
    title: `${store.businessName} - Store on MangwaooMart`,
    description: `Browse all ads from ${store.businessName} on MangwaooMart.`,
  };
}

// Public seller profile: store name, location and every active ad.
export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [store, ads] = await Promise.all([getStore(id), getSellerAds(id)]);

  if (!store) {
    notFound();
  }

  const location = formatLocation(store.city, store.country);

  return (
    <div className="w-full py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/mart"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to MangwaooMart
        </Link>

        <section
          aria-labelledby="store-name"
          className="flex flex-col gap-6 rounded-3xl border border-gray-100 bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between md:p-8"
        >
          <div className="flex min-w-0 items-center gap-5">
            <span
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-red-primary/10 text-3xl font-bold text-accent"
            >
              {store.businessName.trim().charAt(0).toUpperCase() || '?'}
            </span>

            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-gray">Store</p>
              <h1 id="store-name" className="break-words text-2xl font-bold text-ink md:text-3xl">
                {store.businessName}
              </h1>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-gray">
                <li className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="font-semibold text-ink">{location}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-accent" />
                  Active ads: <span className="font-semibold text-ink">{ads.length}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-accent" />
                  Member since <span className="font-semibold text-ink">{formatMonthYear(store.createdAt)}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <ChatWidget
              sellerId={store.id}
              sellerName={store.businessName}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-accent px-5 py-2.5 text-sm font-semibold text-accent hover:bg-brand-red-primary hover:text-white transition-all duration-300"
            />
            <ShareButton
              path={`/store/${store.id}`}
              title={store.businessName}
              text={`${store.businessName} on MangwaooMart`}
              label="Share store"
            />
          </div>
        </section>

        <section aria-labelledby="store-ads-heading" className="mt-12">
          <h2 id="store-ads-heading" className="mb-5 text-xl font-bold text-ink">
            Active ads ({ads.length})
          </h2>

          {ads.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} showStore={false} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-gray-100 bg-surface p-8 text-center text-sm text-brand-gray">
              This store has no active ads right now.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
