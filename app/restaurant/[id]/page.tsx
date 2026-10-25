import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Bike, Clock, Info, MapPin, Store } from 'lucide-react';
import NearbyNotice from '@/components/NearbyNotice';
import { getRestaurant, itemMatchesQuery, normalizeQuery } from '@/lib/food-search';
import { deliveryFeeForDistance, farAwayNote, foodReach } from '@/lib/delivery';
import { formatDistance, isRealLocation, parseCoordinates } from '@/lib/geo';
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

  // The customer's address comes along from the lists, so show how far this kitchen is and what the delivery costs. The
  // menu is served to everyone with a kitchen pinned on the map (so the distance, and the delivery charge, can be known);
  // a kitchen beyond 5 km gets a note that the delivery charge is higher.
  const parsedOrigin = parseCoordinates(lat, lng);
  const origin = isRealLocation(parsedOrigin) ? parsedOrigin : null;
  const reach = foodReach(origin, restaurant.location);
  const distanceKm = reach.status === 'OK' || reach.status === 'FAR' ? reach.distanceKm : null;

  if (origin && reach.status === 'NO_PIN') {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <NearbyNotice lat={origin.lat} lng={origin.lng} params={q ? { q } : {}} variant="quiet" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-red-primary/10 text-accent">
          <MapPin className="h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-ink">{restaurant.name} can&apos;t deliver to your address yet</h1>
        <p className="mb-8 text-brand-gray">
          This restaurant hasn&apos;t set its location on the map yet, so we can&apos;t work out how far it is or what the delivery would cost.
        </p>
        <Link
          href={`/gulplaza?lat=${origin.lat}&lng=${origin.lng}`}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
        >
          See restaurants near you
        </Link>
      </div>
    );
  }

  const menu = restaurant.categories.map((category) => ({
    category,
    items: restaurant.items.filter((item) => item.category === category),
  }));

  return (
    <div className="w-full pb-28">
      {/* Banner */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-red-primary to-brand-red-secondary text-white">
        {restaurant.coverImage ? (
          // The owner's own background picture: shown sharp behind the name. The gradient below keeps the text readable.
          // eslint-disable-next-line @next/next/no-img-element -- served by /api/restaurants/[id]/cover
          <img
            src={restaurant.coverImage}
            alt=""
            aria-hidden
            fetchPriority="high"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        ) : restaurant.bannerImage ? (
          // No background picture yet: a blurred dish photo stands in for it.
          // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
          <img
            src={restaurant.bannerImage}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover opacity-40 blur-sm"
          />
        ) : null}
        {/* A bit darker over the owner's own picture, which can be as bright as a white plate: the name must stay readable. */}
        <div
          className={`absolute inset-0 -z-10 bg-gradient-to-t ${
            restaurant.coverImage ? 'from-black/75 via-black/35 to-black/20' : 'from-black/70 via-black/30 to-black/10'
          }`}
        />

        <div className="mx-auto flex min-h-[15rem] max-w-5xl flex-col justify-between px-4 py-6 sm:px-6 md:min-h-[18rem] lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={origin ? `/gulplaza?lat=${origin.lat}&lng=${origin.lng}` : '/gulplaza'}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-black/50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Food
            </Link>
            <FavouriteButton kind="RESTAURANT" id={restaurant.id} name={restaurant.name} variant="glass" />
          </div>

          <div className="mt-8 flex items-end gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/80 bg-surface text-accent shadow-lg md:h-24 md:w-24">
              {restaurant.thumbnailImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- seller-supplied image URL
                <img src={restaurant.thumbnailImage} alt={restaurant.name} className="h-full w-full object-cover" />
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
        <NearbyNotice lat={origin?.lat ?? null} lng={origin?.lng ?? null} params={q ? { q } : {}} variant="quiet" />

        {reach.status === 'FAR' ? (
          <p role="note" className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span>{farAwayNote(reach.distanceKm)}</span>
          </p>
        ) : null}

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
