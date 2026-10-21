import { GULPLAZA_CATEGORIES } from '@/lib/data';
import { distanceInKm, type Coordinates } from '@/lib/geo';
import { getGulplazaProducts } from '@/lib/products';

export const FOOD_CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon])
);

export type FoodItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  vendor: string;
  sellerId: string;
  priceValue: number;
  price: string;
  icon: string;
  imageUrl: string | null;
  stock: number;
};

/** Where a restaurant's kitchen is, when its owner has pinned it on the map. */
export type RestaurantLocation = Coordinates & { label: string | null };

export type Restaurant = {
  id: string;
  name: string;
  items: FoodItem[];
  categories: string[];
  bannerImage: string | null;
  location: RestaurantLocation | null;
};

type GulplazaProductRow = Awaited<ReturnType<typeof getGulplazaProducts>>[number];

function toFoodItem(product: GulplazaProductRow): FoodItem {
  const priceValue = Number(product.price);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category.name,
    vendor: product.seller.businessName,
    sellerId: product.sellerId,
    priceValue,
    price: `PKR ${priceValue.toLocaleString()}`,
    icon: FOOD_CATEGORY_ICONS[product.category.name] ?? '🍽️',
    imageUrl: product.images[0] ?? null,
    stock: product.stock,
  };
}

function toRestaurant(seller: GulplazaProductRow['seller'], items: FoodItem[]): Restaurant {
  return {
    id: seller.id,
    name: seller.businessName,
    items,
    categories: [...new Set(items.map((item) => item.category))],
    bannerImage: items.find((item) => item.imageUrl)?.imageUrl ?? null,
    location:
      seller.latitude !== null && seller.longitude !== null
        ? { lat: seller.latitude, lng: seller.longitude, label: seller.locationLabel }
        : null,
  };
}

/** All approved food restaurants with at least one active item. */
export async function getRestaurants(): Promise<Restaurant[]> {
  const products = await getGulplazaProducts();
  const bySeller = new Map<string, { seller: GulplazaProductRow['seller']; items: FoodItem[] }>();

  for (const product of products) {
    const entry = bySeller.get(product.sellerId) ?? { seller: product.seller, items: [] };
    entry.items.push(toFoodItem(product));
    bySeller.set(product.sellerId, entry);
  }

  return [...bySeller.values()].map(({ seller, items }) => toRestaurant(seller, items));
}

export async function getRestaurant(sellerId: string): Promise<Restaurant | null> {
  const restaurants = await getRestaurants();
  return restaurants.find((restaurant) => restaurant.id === sellerId) ?? null;
}

export function normalizeQuery(query: string | undefined) {
  return (query ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Matching ────────────────────────────────────────────────────────────────
// Words are compared by their start, so "tea" finds "Tea" and "Tea Pot" but not "steak",
// and "zing" finds "Zinger" while typing. Plurals and common spellings are folded together.

const SPELLING_VARIANTS: Record<string, string> = {
  briyani: 'biryani',
  biriyani: 'biryani',
  biriani: 'biryani',
  biryany: 'biryani',
  pulav: 'pulao',
  palao: 'pulao',
  pilau: 'pulao',
  pilaf: 'pulao',
  zingar: 'zinger',
  zinjer: 'zinger',
  chai: 'tea',
};

function canonicalWord(word: string) {
  const stem = word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
  return SPELLING_VARIANTS[stem] ?? stem;
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9؀-ۿ]+/)
    .filter(Boolean)
    .map(canonicalWord);
}

const startsAnyToken = (tokens: string[], word: string) => tokens.some((token) => token.startsWith(word));

/**
 * An item matches when every word of the query appears in the item (name, description or
 * category) or in its restaurant's name, and at least one word is in the item itself.
 * So "hashim biryani" finds Hashim's biryani dishes, while "zinger" alone doesn't flag a
 * restaurant called "Zinger House"'s whole menu.
 */
export function itemMatchesQuery(item: FoodItem, query: string, restaurantName = '') {
  const words = tokenize(normalizeQuery(query));
  if (words.length === 0) return false;

  const itemTokens = tokenize(`${item.name} ${item.description ?? ''} ${item.category}`);
  const nameTokens = tokenize(restaurantName);

  return (
    words.every((word) => startsAnyToken(itemTokens, word) || startsAnyToken(nameTokens, word)) &&
    words.some((word) => startsAnyToken(itemTokens, word))
  );
}

function restaurantNameMatches(restaurant: Restaurant, query: string) {
  const words = tokenize(normalizeQuery(query));
  const nameTokens = tokenize(restaurant.name);
  return words.length > 0 && words.every((word) => startsAnyToken(nameTokens, word));
}

export type RestaurantMatch = {
  restaurant: Restaurant;
  matches: FoodItem[];
  /** Straight-line distance from the customer's address; null when either location is unknown. */
  distanceKm: number | null;
};

/**
 * Restaurants with dishes matching the query. With the customer's location the nearest
 * restaurants come first (restaurants that haven't pinned a location come last);
 * without it, a restaurant whose own name matches comes first, then the one with most matches.
 */
export async function searchRestaurants(query: string, origin: Coordinates | null = null): Promise<RestaurantMatch[]> {
  const restaurants = await getRestaurants();

  return restaurants
    .map((restaurant) => {
      const itemMatches = restaurant.items.filter((item) => itemMatchesQuery(item, query, restaurant.name));
      // Searching a restaurant by name finds the restaurant even if no single dish matches.
      const matches = itemMatches.length > 0 || !restaurantNameMatches(restaurant, query) ? itemMatches : restaurant.items;
      const distanceKm = origin && restaurant.location ? distanceInKm(origin, restaurant.location) : null;
      return { restaurant, matches, distanceKm };
    })
    .filter((result) => result.matches.length > 0)
    .sort((a, b) => {
      if (origin && a.distanceKm !== b.distanceKm) {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      }

      // A restaurant whose own name matches is the strongest signal, then how many items match.
      const aNamed = restaurantNameMatches(a.restaurant, query) ? 1 : 0;
      const bNamed = restaurantNameMatches(b.restaurant, query) ? 1 : 0;
      return bNamed - aNamed || b.matches.length - a.matches.length || a.restaurant.name.localeCompare(b.restaurant.name);
    });
}
