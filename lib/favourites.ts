import { prisma } from '@/lib/prisma';
import { getLikedAds } from '@/lib/ads';
import { getRestaurants, type FoodItem, type Restaurant } from '@/lib/food-search';

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

/** Everything on the Favourites page, newest saved first. Anything no longer listed is left out. */
export async function getFavouritesPage(userId: string) {
  const [rows, restaurants, likedAds] = await Promise.all([
    prisma.favourite.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { kind: true, targetId: true } }),
    getRestaurants(),
    getLikedAds(userId),
  ]);

  const restaurantsById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const dishesById = new Map(restaurants.flatMap((restaurant) => restaurant.items.map((item) => [item.id, item] as const)));

  return {
    restaurants: rows
      .filter((row) => row.kind === 'RESTAURANT')
      .flatMap((row) => restaurantsById.get(row.targetId) ?? []) satisfies Restaurant[],
    dishes: rows.filter((row) => row.kind === 'DISH').flatMap((row) => dishesById.get(row.targetId) ?? []) satisfies FoodItem[],
    ads: likedAds,
  };
}
