import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Bike, Clock, MapPin, Store } from 'lucide-react';
import { getRestaurant, itemMatchesQuery, normalizeQuery } from '@/lib/food-search';
import { deliveryFeeForDistance } from '@/lib/delivery';
import { distanceInKm, formatDistance, parseCoordinates } from '@/lib/geo';
import FavouriteButton from '@/components/FavouriteButton';
import RestaurantMenuItem from '@/components/RestaurantMenuItem';
import CartBar from '@/components/CartBar';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const restaurant = await getRestaurant((await params).id);
  return { title: restaurant ? `${restaurant.name} - Mangwaoo` : 'Restaurant - Mangwaoo' };
}

export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; lat?: string; lng?: string }>;
}) {
  const [{ id }, { q, lat, lng }] = await Promise.all([params, searchParams]);
  const restaurant = await getRestaurant(id);

  if (!restaurant) {
    notFound();
  }

  const query = normalizeQuery(q);
  const matches = query ? restaurant.items.filter((item) => itemMatchesQuery(item, query, restaurant.name)) : [];

  // The customer's address comes along from search, so show how far this kitchen is.
  const origin = parseCoordinates(lat, lng);
  const distanceKm = origin && restaurant.location ? distanceInKm(origin, restaurant.location) : null;

  const menu = restaurant.categories.map((category) => ({
    category,
    items: restaurant.items.filter((item) => item.category === category),
  }));

  return (
    <div className="w-full pb-28">
      {/* Banner */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-red-primary to-brand-red-secondary text-white">
        {restaurant.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
          <img
            src={restaurant.bannerImage}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-40 blur-sm"
          />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

        <div className="mx-auto flex min-h-[15rem] max-w-5xl flex-col justify-between px-4 py-6 sm:px-6 md:min-h-[18rem] lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <Link
              href="/gulplaza"
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-black/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Food
            </Link>
            <FavouriteButton kind="RESTAURANT" id={restaurant.id} name={restaurant.name} variant="glass" />
          </div>

          <div className="mt-8 flex items-end gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/80 bg-surface text-accent shadow-lg md:h-24 md:w-24">
              {restaurant.bannerImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
                <img src={restaurant.bannerImage} alt={restaurant.name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-9 w-9" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold leading-tight md:text-4xl">{restaurant.name}</h1>
              <p className="mt-1 line-clamp-1 text-sm text-white/85">{restaurant.categories.join(' · ')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified seller
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                  <Clock className="h-3.5 w-3.5" />
                  12 PM – 1 AM
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                  {restaurant.items.length} {restaurant.items.length === 1 ? 'item' : 'items'}
                </span>
                {distanceKm !== null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                    <MapPin className="h-3.5 w-3.5" />
                    {formatDistance(distanceKm)} away
                  </span>
                ) : null}
                {distanceKm !== null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                    <Bike className="h-3.5 w-3.5" />
                    Delivery PKR {deliveryFeeForDistance(distanceKm)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {matches.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-lg font-bold text-ink">
              Matching “{q?.trim()}”
              <span className="ml-2 text-sm font-normal text-brand-gray">({matches.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {matches.map((item) => (
                <RestaurantMenuItem key={item.id} item={item} highlight />
              ))}
            </div>
          </section>
        )}

        {menu.length > 1 && (
          <nav className="sticky top-0 z-30 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-surface/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-full sm:px-3" aria-label="Menu sections">
            {menu.map(({ category }) => (
              <a
                key={category}
                href={`#${encodeURIComponent(category)}`}
                className="shrink-0 rounded-full border border-gray-200 px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
              >
                {category}
              </a>
            ))}
          </nav>
        )}

        <div className="space-y-10">
          {menu.map(({ category, items }) => (
            <section key={category} id={encodeURIComponent(category)} className="scroll-mt-20">
              <h2 className="mb-3 text-xl font-bold text-ink">{category}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <RestaurantMenuItem key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <CartBar />
    </div>
  );
}
