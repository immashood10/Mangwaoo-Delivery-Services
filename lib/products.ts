import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { FOOD_CATALOG_TAG, MART_CATALOG_TAG } from '@/lib/catalog-cache';

// The remote DB round-trip is the single most expensive part of rendering
// /mart, /gulplaza, and the home page. Both catalog pages read `searchParams`,
// which forces Next to render them dynamically per request — so the route-level
// `revalidate` export (which only caches whole static routes) can't help them.
// Caching the query itself with unstable_cache does: the DB is hit at most once
// per revalidate window, and the (cheap) q/category filtering still runs fresh
// per request on the cached result.
export const getMartProducts = unstable_cache(
  async () =>
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, seller: true },
      orderBy: { createdAt: 'desc' },
    }),
  ['mart-products'],
  { revalidate: 300, tags: [MART_CATALOG_TAG] }
);

export const getGulplazaProducts = unstable_cache(
  async () =>
    prisma.gulplazaProduct.findMany({
      where: {
        isActive: true,
        seller: { isApproved: true, sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] } },
      },
      include: { category: true, seller: true },
      orderBy: { createdAt: 'desc' },
    }),
  ['gulplaza-products'],
  { revalidate: 300, tags: [FOOD_CATALOG_TAG] }
);
