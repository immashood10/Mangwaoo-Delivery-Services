import { prisma } from '@/lib/prisma';
import { getLikedAds } from '@/lib/ads';
import { foodReach } from '@/lib/delivery';
import { getRestaurants, type FoodItem, type Restaurant } from '@/lib/food-search';
import type { Coordinates } from '@/lib/geo';

// Restaurants and dishes a user saved with the heart button. Everything is stored in the database
// (Favourite), so the list follows the account to any browser or device.

export const MAX_FAVOURITES = 300;

/** The ids a user has saved, for showing the hearts. */
export async function getFavouriteIds(userId: string) {
  const rows = await prisma.favourite.findMany({ where: { userId }, select: { kind: true, targetId: true } });

  return {
    restaurants: rows.filter((row) => row.kind === 'RESTAURANT').map((row) => row.targetId),
    dishes: rows.filter((row) => row.kind === 'DISH').map((row) => row.targetId),
  };
}

/**
 * Everything on the Favourites page, newest saved first. Anything no longer listed is left out, and, once the
 * customer's location is known (`origin`), so is every restaurant (and its dishes) that has no pin on the map, because
 * its distance and delivery charge can't be worked out; `hidden` counts those so the page can say so. Restaurants
 * farther than 5 km stay (they can be ordered from, and their page says the delivery charge is higher).
 */
export async function getFavouritesPage(userId: string, origin: Coordinates | null = null) {
  const [rows, restaurants, likedAds] = await Promise.all([
    prisma.favourite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { kind: true, targetId: true } }),
    getRestaurants(),
    getLikedAds(userId),
  ]);

  const restaurantsById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const dishesById = new Map(
    restaurants.flatMap((restaurant) => restaurant.items.map((item) => [item.id, { item, restaurant }] as const))
  );
  // Without a location nothing can be judged, so everything saved is shown until it is known.
  const reaches = (restaurant: Restaurant) => !origin || foodReach(origin, restaurant.location).status !== 'NO_PIN';

  const savedRestaurants = rows.filter((row) => row.kind === 'RESTAURANT').flatMap((row) => restaurantsById.get(row.targetId) ?? []);
  const savedDishes = rows.filter((row) => row.kind === 'DISH').flatMap((row) => dishesById.get(row.targetId) ?? []);
  const nearbyRestaurants = savedRestaurants.filter(reaches) satisfies Restaurant[];
  const nearbyDishes = savedDishes.filter(({ restaurant }) => reaches(restaurant)).map(({ item }) => item) satisfies FoodItem[];

  return {
    restaurants: nearbyRestaurants,
    dishes: nearbyDishes,
    ads: likedAds,
    hidden: savedRestaurants.length - nearbyRestaurants.length + (savedDishes.length - nearbyDishes.length),
  };
}
