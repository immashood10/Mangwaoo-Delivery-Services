import Link from 'next/link';
import { ArrowRight, Heart, Store } from 'lucide-react';
import AdCard from '@/components/AdCard';
import FavouriteButton from '@/components/FavouriteButton';
import FavouritesLoginPrompt from '@/components/FavouritesLoginPrompt';
import NearbyNotice from '@/components/NearbyNotice';
import RestaurantMenuItem from '@/components/RestaurantMenuItem';
import { getSession } from '@/lib/auth';
import { getFavouritesPage } from '@/lib/favourites';
import { isRealLocation, parseCoordinates } from '@/lib/geo';

export const metadata = {
  title: 'Favourites - Mangwaoo',
};

export default async function FavouritesPage({ searchParams }: { searchParams: Promise<{ lat?: string; lng?: string }> }) {
  const [session, { lat, lng }] = await Promise.all([getSession(), searchParams]);

  if (!session) {
    return <FavouritesLoginPrompt />;
  }

  // Restaurants (and their dishes) that haven't pinned their kitchen on the map are not shown, as their delivery charge
  // can't be worked out. The location comes with the address (`?lat=&lng=`, kept in step by NearbyNotice); until it is
  // known everything shows.
  const parsedOrigin = parseCoordinates(lat, lng);
  const origin = isRealLocation(parsedOrigin) ? parsedOrigin : null;
  const locationQuery = origin ? `?lat=${origin.lat}&lng=${origin.lng}` : '';
  const { restaurants, dishes, ads, hidden } = await getFavouritesPage(session.userId, origin);
  const hiddenNote =
    hidden > 0 ? (
      <p className="mb-6 rounded-xl bg-brand-light px-4 py-3 text-sm text-brand-gray">
        {hidden} saved {hidden === 1 ? 'restaurant or dish is' : 'restaurants and dishes are'} from a restaurant that hasn&apos;t set its location on the map yet, so
        {hidden === 1 ? ' it isn' : ' they aren'}&apos;t shown.
      </p>
    ) : null;

  if (restaurants.length + dishes.length + ads.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <NearbyNotice lat={origin?.lat ?? null} lng={origin?.lng ?? null} variant="quiet" />
        {hiddenNote}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-red-primary/10">
          <Heart className="h-8 w-8 text-accent" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-ink">No Favourites Saved</h1>
        <p className="mb-8 text-brand-gray">
          You&rsquo;ll see all your favourites here, to make ordering even faster. Just look for the{' '}
          <Heart className="inline h-4 w-4 align-text-bottom text-accent" role="img" aria-label="heart" />
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/gulplaza"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
          >
            Browse restaurants
          </Link>
          <Link
            href="/mart"
            className="inline-flex items-center justify-center rounded-xl border-2 border-accent px-6 py-3 text-sm font-semibold text-accent transition-colors hover:bg-brand-red-primary hover:text-white"
          >
            Browse MangwaooMart
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 md:py-16">
      <NearbyNotice lat={origin?.lat ?? null} lng={origin?.lng ?? null} variant="quiet" />
      {hiddenNote}
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <Heart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">Favourites</h1>
          <p className="text-brand-gray">Everything you saved, ready to order again.</p>
        </div>
      </div>

      <div className="space-y-12">
        {restaurants.length > 0 ? (
          <section aria-labelledby="fav-restaurants-heading">
            <h2 id="fav-restaurants-heading" className="mb-4 text-lg font-bold text-ink">
              Restaurants <span className="text-sm font-normal text-brand-gray">({restaurants.length})</span>
            </h2>
            <ul className="space-y-3">
              {restaurants.map((restaurant) => (
                <li key={restaurant.id} className="relative">
                  <Link
                    href={`/restaurant/${restaurant.id}${locationQuery}`}
                    className="group flex items-center gap-4 rounded-2xl bg-surface p-4 pr-28 shadow-soft transition hover:shadow-md"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-red-primary to-brand-red-secondary text-white">
                      {restaurant.thumbnailImage ? (
                        // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
                        <img src={restaurant.thumbnailImage} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Store className="h-7 w-7" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-ink">{restaurant.name}</h3>
                      <p className="line-clamp-1 text-sm text-brand-gray">{restaurant.categories.join(' · ')}</p>
                      <p className="text-xs text-brand-gray">
                        {restaurant.items.length} {restaurant.items.length === 1 ? 'item' : 'items'} on the menu
                      </p>
                    </div>
                  </Link>
                  <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-3">
                    <FavouriteButton kind="RESTAURANT" id={restaurant.id} name={restaurant.name} />
                    <ArrowRight className="h-5 w-5 text-brand-gray" aria-hidden="true" />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {dishes.length > 0 ? (
          <section aria-labelledby="fav-dishes-heading">
            <h2 id="fav-dishes-heading" className="mb-4 text-lg font-bold text-ink">
              Dishes <span className="text-sm font-normal text-brand-gray">({dishes.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {dishes.map((dish) => (
                <div key={dish.id}>
                  <p className="mb-1.5 px-1 text-xs text-brand-gray">
                    from{' '}
                    <Link href={`/restaurant/${dish.sellerId}${locationQuery}`} className="font-semibold text-accent hover:underline">
                      {dish.vendor}
                    </Link>
                  </p>
                  <RestaurantMenuItem item={dish} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {ads.length > 0 ? (
          <section aria-labelledby="fav-ads-heading">
            <h2 id="fav-ads-heading" className="mb-4 text-lg font-bold text-ink">
              Ads you liked <span className="text-sm font-normal text-brand-gray">({ads.length})</span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
