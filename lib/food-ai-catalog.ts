import { FOOD_CATEGORY_ICONS } from '@/lib/food-search';
import { foodReach } from '@/lib/delivery';
import { readPortions, type Portion } from '@/lib/food-portions';
import { isRealLocation, type Coordinates } from '@/lib/geo';
import { prisma } from '@/lib/prisma';
import type { FoodSearchIntent } from '@/lib/food-ai-search';
import type { FoodDishTag, FoodSpiceLevelKey } from '@/lib/food-ai-metadata';

export type AssistantDish = {
  id: string;
  marketplace: 'gulplaza';
  name: string;
  category: string;
  icon: string;
  vendor: string;
  sellerId: string;
  price: number;
  portions: Portion[];
  spiceLevel: FoodSpiceLevelKey | null;
  dishTags: FoodDishTag[];
  available: boolean;
  distanceKm: number | null;
  deliveryNearby: boolean | null;
};

function keywordWhere(terms: string[]) {
  return terms.length
    ? {
        AND: terms.map((term) => ({
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { description: { contains: term, mode: 'insensitive' as const } },
            { category: { name: { contains: term, mode: 'insensitive' as const } } },
            { seller: { businessName: { contains: term, mode: 'insensitive' as const } } },
          ],
        })),
      }
    : {};
}

async function queryDishes(intent: FoodSearchIntent) {
  const products = await prisma.gulplazaProduct.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      seller: { isApproved: true, sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] }, user: { isActive: true } },
      ...(intent.maxPrice !== null ? { price: { lte: intent.maxPrice } } : {}),
      ...(intent.spice.length ? { spiceLevel: { in: intent.spice } } : {}),
      ...(intent.tags.length ? { dishTags: { hasEvery: intent.tags } } : {}),
      ...keywordWhere(intent.terms),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 50,
    select: {
      id: true,
      name: true,
      price: true,
      portions: true,
      stock: true,
      spiceLevel: true,
      dishTags: true,
      category: { select: { name: true } },
      seller: { select: { id: true, businessName: true, latitude: true, longitude: true } },
    },
  });
  return products;
}

function toAssistantDish(product: Awaited<ReturnType<typeof queryDishes>>[number], origin: Coordinates | null, maxPrice: number | null = null): AssistantDish | null {
  const portions = readPortions(product.portions);
  const matchingPortions = portions.filter((portion) => Number.isFinite(portion.price) && (maxPrice === null || portion.price <= maxPrice));
  if (portions.length > 0 && matchingPortions.length === 0) return null;
  if (portions.length === 0 && maxPrice !== null && Number(product.price) > maxPrice) return null;

  let distanceKm: number | null = null;
  let deliveryNearby: boolean | null = null;
  if (isRealLocation(origin)) {
    const reach = foodReach(origin, product.seller.latitude !== null && product.seller.longitude !== null
      ? { lat: product.seller.latitude, lng: product.seller.longitude }
      : null);
    if (reach.status !== 'OK') return null;
    distanceKm = reach.distanceKm;
    deliveryNearby = true;
  }

  return {
    id: product.id,
    marketplace: 'gulplaza',
    name: product.name,
    category: product.category.name,
    icon: FOOD_CATEGORY_ICONS[product.category.name] ?? '🍽️',
    vendor: product.seller.businessName,
    sellerId: product.seller.id,
    price: Number(product.price),
    portions: matchingPortions,
    spiceLevel: product.spiceLevel,
    dishTags: product.dishTags as FoodDishTag[],
    available: product.stock > 0,
    distanceKm,
    deliveryNearby,
  };
}

/** Returns live, approved, in-stock products. Gemini only supplies search filters; it never creates catalog rows. */
export async function searchAssistantDishes(intent: FoodSearchIntent, origin: Coordinates | null) {
  const strict = await queryDishes(intent);
  const matches = strict.map((product) => toAssistantDish(product, origin, intent.maxPrice)).filter((product): product is AssistantDish => product !== null);
  if (matches.length > 0) return { products: matches.slice(0, 12), usedFallback: false };

  // Keep the user's price cap and real product terms, but relax missing tags/spice metadata and label these as alternatives.
  const relaxed = await queryDishes({ ...intent, spice: [], tags: [] });
  const alternatives = relaxed.map((product) => toAssistantDish(product, origin, intent.maxPrice)).filter((product): product is AssistantDish => product !== null);
  return { products: alternatives.slice(0, 8), usedFallback: alternatives.length > 0 };
}

/** Database-only ranking by the customer's own delivered food orders, recent popularity, meal time, and distance. */
export async function getFoodRecommendations(input: { customerId?: string; origin: Coordinates | null }) {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const byProduct = await prisma.gulplazaOrderItem.groupBy({
    by: ['productId'],
    where: {
      order: {
        status: 'DELIVERED',
        createdAt: { gte: since },
        ...(input.customerId ? { customerId: input.customerId } : {}),
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 30,
  });

  const ids = byProduct.map((row) => row.productId);
  const products = await prisma.gulplazaProduct.findMany({
    where: { isActive: true, stock: { gt: 0 }, seller: { isApproved: true, sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] }, user: { isActive: true } } },
    orderBy: { createdAt: 'desc' },
    take: 80,
    select: {
      id: true,
      name: true,
      price: true,
      portions: true,
      stock: true,
      spiceLevel: true,
      dishTags: true,
      createdAt: true,
      category: { select: { name: true } },
      seller: { select: { id: true, businessName: true, latitude: true, longitude: true } },
    },
  });
  const popular = new Map(byProduct.map((row) => [row.productId, row._sum.quantity ?? 0]));
  const hourInKarachi = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));

  const scored = products.flatMap((product) => {
    const dish = toAssistantDish(product, input.origin);
    if (!dish) return [];
    const name = `${dish.name} ${dish.category}`.toLowerCase();
    const historyScore = ids.includes(product.id) ? 20 + (popular.get(product.id) ?? 0) * 3 : 0;
    const mealScore = hourInKarachi >= 6 && hourInKarachi < 12
      ? (/breakfast|paratha|omelette|pancake|tea|nashta/.test(name) ? 8 : 0)
      : hourInKarachi >= 12 && hourInKarachi < 17
        ? (/lunch|biryani|rice|pulao|meal|burger|wrap/.test(name) ? 8 : 0)
        : (/dinner|biryani|rice|pulao|meal|pizza|burger|roll/.test(name) ? 8 : 0);
    const areaScore = dish.distanceKm === null ? 0 : Math.max(0, 8 - dish.distanceKm);
    return [{ dish, score: historyScore + mealScore + areaScore + (popular.get(product.id) ?? 0) }];
  });
  scored.sort((a, b) => b.score - a.score || a.dish.name.localeCompare(b.dish.name));
  const pastOrderCount = ids.length;
  return { products: scored.slice(0, 8).map((row) => row.dish), hasOrderHistory: Boolean(input.customerId && pastOrderCount > 0), hasNearby: scored.some((row) => row.dish.deliveryNearby) };
}

export function categoryIcon(category: string) {
  return FOOD_CATEGORY_ICONS[category] ?? '🍽️';
}
