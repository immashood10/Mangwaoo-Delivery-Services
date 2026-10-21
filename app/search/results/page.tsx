import Link from 'next/link';
import { ArrowRight, Bike, MapPin, Search, Store } from 'lucide-react';
import FavouriteButton from '@/components/FavouriteButton';
import SearchLocationNotice from '@/components/SearchLocationNotice';
import { normalizeQuery, searchRestaurants } from '@/lib/food-search';
import { deliveryFeeForDistance } from '@/lib/delivery';
import { formatDistance, parseCoordinates } from '@/lib/geo';

export const metadata = {
  title: 'Search - Mangwaoo',
};

const MAX_DISHES_SHOWN = 4;

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lat?: string; lng?: string }>;
}) {
  const { q, lat, lng } = await searchParams;
  const query = normalizeQuery(q);
  const origin = parseCoordinates(lat, lng);
  const shownQuery = q?.trim() ?? query;

  // /search already redirects the single-restaurant and mart-only cases; this page
  // lists several matching restaurants (nearest first), or says nothing was found.
  const results = query ? await searchRestaurants(query, origin) : [];
  const locationParams = origin ? `&lat=${origin.lat}&lng=${origin.lng}` : '';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="mb-8 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-red-primary/10 text-accent">
          <Search className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">
            {results.length > 0 ? `Restaurants with “${shownQuery}”` : `No results for “${shownQuery}”`}
          </h1>
          <p className="text-brand-gray">
            {results.length > 0
              ? 'Pick a restaurant to see its menu and order.'
              : 'We couldn’t find a matching dish or restaurant. Try a different word.'}
          </p>
        </div>
      </div>

      {results.length > 1 ? <SearchLocationNotice query={shownQuery} lat={origin?.lat ?? null} lng={origin?.lng ?? null} /> : null}

      {results.length > 0 ? (
        <ol className="space-y-4">
          {results.map(({ restaurant, matches, distanceKm }, index) => (
            <li key={restaurant.id} className="relative">
              <Link
                href={`/restaurant/${restaurant.id}?q=${encodeURIComponent(shownQuery)}${locationParams}`}
                className="group flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-soft transition hover:shadow-md"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-red-primary to-brand-red-secondary text-3xl text-white">
                  {restaurant.bannerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
                    <img src={restaurant.bannerImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-8 w-8" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="font-bold text-ink">{restaurant.name}</h2>
                    {distanceKm !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-red-primary/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                        <MapPin className="h-3 w-3" />
                        {formatDistance(distanceKm)} away
                      </span>
                    ) : null}
                    {distanceKm !== null ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand-gray">
                        <Bike className="h-3 w-3" />
                        Delivery PKR {deliveryFeeForDistance(distanceKm)}
                      </span>
                    ) : null}
                    {index === 0 && distanceKm !== null ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">
                        Nearest
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-1 text-sm text-brand-gray">
                    {restaurant.location?.label ?? restaurant.categories.join(' · ')}
                  </p>

                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {matches.slice(0, MAX_DISHES_SHOWN).map((item) => (
                      <li key={item.id} className="text-ink">
                        <span className="font-semibold">{item.name}</span>{' '}
                        <span className="text-brand-gray">{item.price}</span>
                      </li>
                    ))}
                    {matches.length > MAX_DISHES_SHOWN ? (
                      <li className="font-semibold text-accent">+{matches.length - MAX_DISHES_SHOWN} more</li>
                    ) : null}
                  </ul>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-brand-gray transition group-hover:translate-x-1 group-hover:text-accent" />
              </Link>
              <FavouriteButton
                kind="RESTAURANT"
                id={restaurant.id}
                name={restaurant.name}
                className="absolute right-14 top-1/2 -translate-y-1/2"
              />
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/gulplaza"
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
          >
            Browse all Food
          </Link>
          <Link
            href="/mart"
            className="inline-flex items-center rounded-xl border-2 border-accent px-6 py-3 text-sm font-semibold text-accent hover:bg-brand-red-primary hover:text-white"
          >
            Browse MangwaooMart
          </Link>
        </div>
      )}
    </div>
  );
}
