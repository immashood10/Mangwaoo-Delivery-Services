'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Bike, MapPin, Store } from 'lucide-react';
import FavouriteButton from '@/components/FavouriteButton';
import { useDeliveryAddress } from '@/lib/delivery-address-context';
import { deliveryFeeForDistance } from '@/lib/delivery';
import { formatDistance } from '@/lib/geo';
import type { PriceTier, RestaurantCardData } from '@/lib/restaurant-cards';

const MAX_CUISINES = 2;

const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  1: 'Budget-friendly price range',
  2: 'Moderate price range',
  3: 'Premium price range',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
  // The tile behind the photo is the same red gradient, so a photo that can't load just looks like no photo.
  const [photoFailed, setPhotoFailed] = useState(false);
  const cuisines = restaurant.cuisines.slice(0, MAX_CUISINES);
  const moreCuisines = restaurant.cuisines.length - cuisines.length;
  const priceLabel = PRICE_TIER_LABELS[restaurant.priceTier];

  return (
    <motion.li variants={itemVariants} className="relative">
      <Link
        href={`/restaurant/${restaurant.id}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl bg-brand-light shadow-soft transition-shadow duration-300 hover:shadow-md"
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-brand-red-primary to-brand-red-secondary">
          {restaurant.hasImage && !photoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by /api/restaurants/[id]/image
            <img
              src={`/api/restaurants/${restaurant.id}/image`}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white" aria-hidden="true">
              <Store className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="truncate text-base font-bold text-ink">{restaurant.name}</h3>

          <p className="flex items-center gap-1.5 text-sm text-brand-gray">
            <span title={priceLabel} className="shrink-0">
              <span className="sr-only">{priceLabel}</span>
              <span aria-hidden="true" className="font-semibold text-ink">
                {'$'.repeat(restaurant.priceTier)}
                <span className="text-gray-300">{'$'.repeat(3 - restaurant.priceTier)}</span>
              </span>
            </span>
            <span aria-hidden="true">&bull;</span>
            <span className="min-w-0 truncate">{cuisines.join(', ')}</span>
            {/* Outside the truncated text so a long cuisine name never hides it. */}
            {moreCuisines > 0 ? <span className="shrink-0">+{moreCuisines}</span> : null}
          </p>

          <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-brand-gray">
            <span className="inline-flex items-center gap-1">
              <Bike className="h-3.5 w-3.5" aria-hidden="true" />
              {restaurant.distanceKm !== null
                ? `Delivery fee PKR ${deliveryFeeForDistance(restaurant.distanceKm)}`
                : 'Delivery fee: add your address'}
            </span>
            {restaurant.distanceKm !== null ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {formatDistance(restaurant.distanceKm)} away
              </span>
            ) : null}
          </p>
        </div>
      </Link>

      {/* Beside the link, not inside it: a button can't sit in an anchor. */}
      <FavouriteButton kind="RESTAURANT" id={restaurant.id} name={restaurant.name} className="absolute right-3 top-3" />
    </motion.li>
  );
}

/**
 * The restaurants on the home page, below the products. The page itself is the same for everyone; once the
 * customer's delivery address is known the server sends the list again, nearest first, with distances.
 */
export default function RestaurantsSection({ restaurants }: { restaurants: RestaurantCardData[] }) {
  const { address } = useDeliveryAddress();
  const lat = address?.lat ?? null;
  const lng = address?.lng ?? null;
  const [nearby, setNearby] = useState<RestaurantCardData[] | null>(null);

  useEffect(() => {
    if (lat === null || lng === null) return;

    const controller = new AbortController();

    fetch(`/api/restaurants?lat=${lat}&lng=${lng}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { restaurants: RestaurantCardData[] } | null) => {
        if (data) setNearby(data.restaurants);
      })
      // Offline or the address changed again: the list on the page stays as it is.
      .catch(() => {});

    return () => controller.abort();
  }, [lat, lng]);

  const cards = lat !== null && nearby ? nearby : restaurants;
  const isNearestFirst = cards.some((card) => card.distanceKm !== null);

  return (
    <section id="restaurants" aria-labelledby="restaurants-heading" className="scroll-mt-32 bg-surface pb-16 md:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="border-t border-gray-100 pt-12 md:pt-16">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <span className="mb-4 inline-block rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
                Food
              </span>
              <h2 id="restaurants-heading" className="mb-4 text-3xl font-bold text-ink md:text-5xl">
                Order From Local Restaurants
              </h2>
              <p className="max-w-xl text-lg text-brand-gray">
                {isNearestFirst
                  ? 'Nearest to your delivery address first.'
                  : 'Biryani, burgers, desserts and more from approved food businesses across Karachi.'}
              </p>
            </div>
            <Link
              href="/gulplaza"
              className="inline-flex shrink-0 items-center space-x-2 font-semibold text-accent hover:underline"
            >
              <span>Browse all food</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {cards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
              <Store className="mx-auto mb-3 h-8 w-8 text-accent" aria-hidden="true" />
              <p className="mb-1 font-semibold text-ink">No restaurants yet</p>
              <p className="mx-auto mb-5 max-w-md text-sm text-brand-gray">
                Approved restaurants, bakeries and home kitchens will show up here. Own a food business in Karachi?
              </p>
              <Link
                href="/sell"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg"
              >
                Sell food on Mangwaoo
              </Link>
            </div>
          ) : (
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {cards.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </motion.ul>
          )}
        </div>
      </div>
    </section>
  );
}
