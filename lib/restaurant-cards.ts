import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { FOOD_CATALOG_TAG } from '@/lib/catalog-cache';
import { foodReach } from '@/lib/delivery';
import { type Coordinates } from '@/lib/geo';

// Compact restaurant rows for the cards on the home page. Written as raw SQL so one query returns
// just what a card shows, and so the dish photos (data URLs) stay out of the page: a card loads its
// picture from /api/restaurants/[id]/image (or /cover, the owner's own background picture, when they uploaded one).

/** How many of the three "$" are lit. */
export type PriceTier = 1 | 2 | 3;

/** What a restaurant card shows. A kitchen's own coordinates stay on the server; only the distance leaves it. */
export type RestaurantCardData = {
  id: string;
  name: string;
  /** The food categories its dishes are listed under, the one with most dishes first. */
  cuisines: string[];
  priceTier: PriceTier;
  /** There is a picture to show: a listed dish has a photo (/api/restaurants/[id]/image) or the owner added a cover. */
  hasImage: boolean;
  /** When the owner's background picture was set (a version for its address), null when there is none. */
  coverVersion: number | null;
  /** Straight-line distance from the customer's address (every card shown is within the delivery radius). */
  distanceKm: number | null;
};

/** The home page shows this many restaurants. */
export const HOME_RESTAURANT_LIMIT = 8;

// A median dish price (PKR) up to the first limit is "$", up to the second "$$", anything above "$$$".
const PRICE_TIER_LIMITS = [500, 1200] as const;

/** The price range of a menu, from its typical (median) dish price so one pricey platter doesn't skew it. */
export function priceTierFor(prices: number[]): PriceTier {
  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;

  if (median <= PRICE_TIER_LIMITS[0]) return 1;
  return median <= PRICE_TIER_LIMITS[1] ? 2 : 3;
}

type RestaurantRow = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
  prices: number[];
  hasImage: boolean;
  coverVersion: number | null;
};

type Restaurant = Omit<RestaurantCardData, 'distanceKm'> & { location: Coordinates | null };

function toRestaurant(row: RestaurantRow): Restaurant {
  const dishesPerCategory = new Map<string, number>();
  for (const category of row.categories) {
    dishesPerCategory.set(category, (dishesPerCategory.get(category) ?? 0) + 1);
  }

  return {
    id: row.id,
    name: row.name,
    cuisines: [...dishesPerCategory]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([category]) => category),
    priceTier: priceTierFor(row.prices),
    hasImage: row.hasImage,
    coverVersion: row.coverVersion,
    location: row.latitude !== null && row.longitude !== null ? { lat: row.latitude, lng: row.longitude } : null,
  };
}

// Approved food restaurants with at least one listed dish, the fullest menus first. Cached like the
// rest of the food catalog, so a seller's change (a new dish, a moved pin) shows up on the next request.
const getRestaurants = unstable_cache(
  async (): Promise<Restaurant[]> => {
    const rows = await prisma.$queryRaw<RestaurantRow[]>`
      SELECT s."id", s."businessName" AS "name", s."latitude", s."longitude",
             array_agg(c."name") AS "categories",
             array_agg(p."price"::float8) AS "prices",
             (bool_or(cardinality(p."images") > 0) OR s."coverUpdatedAt" IS NOT NULL) AS "hasImage",
             (extract(epoch FROM s."coverUpdatedAt") * 1000)::float8 AS "coverVersion"
      FROM "Seller" s
      JOIN "GulplazaProduct" p ON p."sellerId" = s."id" AND p."isActive" = true
      JOIN "GulplazaCategory" c ON c."id" = p."categoryId"
      WHERE s."isApproved" = true AND s."sellerType" IN ('GULPLAZA_OWNER', 'WHOLESALER')
      GROUP BY s."id"
      ORDER BY count(*) DESC, s."businessName"`;

    return rows.map(toRestaurant);
  },
  ['restaurant-cards'],
  { revalidate: 300, tags: [FOOD_CATALOG_TAG] }
);

/**
 * The restaurants to show a customer: only those within the delivery radius (`FOOD_DELIVERY_RADIUS_KM`, 5 km) of
 * their location, nearest first. A restaurant that hasn't pinned its kitchen on the map can't be shown (nobody can tell
 * how far it is), and without a location nothing can be shown either, so the answer is empty.
 */
export async function getRestaurantCards(origin: Coordinates | null = null, limit = HOME_RESTAURANT_LIMIT): Promise<RestaurantCardData[]> {
  if (!origin) return [];

  const restaurants = await getRestaurants();

  return restaurants
    .flatMap(({ location, ...card }) => {
      const reach = foodReach(origin, location);

      return reach.status === 'OK' ? [{ ...card, distanceKm: reach.distanceKm }] : [];
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
