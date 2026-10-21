import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseVehicleDetails, type VehicleDetails } from '@/lib/vehicle-details';

// Compact ad rows for card grids (related ads, a store's ads). Written as raw SQL so
// one query returns everything, and so the photos — stored as data URLs, up to 6 per
// ad — stay out of the page: cards load their picture from /api/products/[id]/image.

export type AdCardData = {
  id: string;
  adNumber: number;
  name: string;
  price: number;
  category: string;
  hasImage: boolean;
  vehicle: VehicleDetails | null;
  sellerId: string;
  storeName: string;
  createdAt: Date;
};

export type AdRow = Omit<AdCardData, 'vehicle'> & { attributes: unknown };

export const CARD_COLUMNS = Prisma.sql`
  p."id", p."adNumber", p."name", p."price"::float8 AS "price", p."attributes", p."createdAt",
  cardinality(p."images") > 0 AS "hasImage",
  c."name" AS "category", p."sellerId", s."businessName" AS "storeName"`;

const CARD_JOINS = Prisma.sql`
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."categoryId"
  JOIN "Seller" s ON s."id" = p."sellerId"`;

export function toAdCards(rows: AdRow[]): AdCardData[] {
  return rows.map(({ attributes, ...ad }) => ({ ...ad, vehicle: parseVehicleDetails(attributes) }));
}

/** Other active ads from the same category, newest first. */
export async function getRelatedAds(productId: string, categoryId: string, limit = 8) {
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT ${CARD_COLUMNS} ${CARD_JOINS}
    WHERE p."isActive" = true AND p."categoryId" = ${categoryId} AND p."id" <> ${productId}
    ORDER BY p."createdAt" DESC
    LIMIT ${limit}`;

  return toAdCards(rows);
}

/** Every active ad a seller has, newest first. */
export async function getSellerAds(sellerId: string) {
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT ${CARD_COLUMNS} ${CARD_JOINS}
    WHERE p."isActive" = true AND p."sellerId" = ${sellerId}
    ORDER BY p."createdAt" DESC`;

  return toAdCards(rows);
}

/** The active ads a user liked, most recently liked first (they appear on the Favourites page). */
export async function getLikedAds(userId: string) {
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT ${CARD_COLUMNS} ${CARD_JOINS}
    JOIN "ProductLike" l ON l."productId" = p."id"
    WHERE p."isActive" = true AND l."userId" = ${userId}
    ORDER BY l."createdAt" DESC`;

  return toAdCards(rows);
}

export function getStore(sellerId: string) {
  // A store whose account an admin deleted has no public page any more.
  return prisma.seller.findFirst({
    where: { id: sellerId, user: { deletedAt: null } },
    select: { id: true, businessName: true, city: true, country: true, createdAt: true },
  });
}

/** "12 Mar 2026" — fixed locale so server and browser agree. */
export function formatAdDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Mar 2026" for "Member since". */
export function formatMonthYear(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
