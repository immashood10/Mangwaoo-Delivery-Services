import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { KARACHI_UTC_OFFSET_MS, startOfKarachiDay } from '@/lib/admin-stats';
import { isFoodSeller, type CurrentSeller } from '@/lib/seller-context';
import { sellerMarketplace } from '@/lib/seller-data';
import type { Marketplace } from '@/lib/seller-types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const STATS_RANGES = [7, 30, 90] as const;
export type StatsRange = (typeof STATS_RANGES)[number];
export const DEFAULT_STATS_RANGE: StatsRange = 30;

export function parseStatsRange(value: string | undefined): StatsRange {
  const parsed = Number(value);
  return (STATS_RANGES as readonly number[]).includes(parsed) ? (parsed as StatsRange) : DEFAULT_STATS_RANGE;
}

export type SalesDay = {
  date: string; // YYYY-MM-DD, Karachi time
  label: string; // e.g. "13 Oct"
  units: number;
  revenue: number;
  orders: number;
};

export type SellerStats = {
  rangeDays: StatsRange;
  days: SalesDay[];
  topProducts: { name: string; units: number; revenue: number }[];
  totals: {
    unitsSold: number;
    revenue: number;
    deliveredOrders: number;
    inProgressOrders: number;
    cancelledOrders: number;
  };
  activeProducts: number;
  /** Likes on the seller's ads (MangwaooMart only). */
  likes: number | null;
  inCarts: number;
};

function tablesFor(marketplace: Marketplace) {
  // Fixed names chosen here, never user input.
  return marketplace === 'MART'
    ? { order: Prisma.raw('"Order"'), item: Prisma.raw('"OrderItem"'), product: Prisma.raw('"Product"') }
    : { order: Prisma.raw('"GulplazaOrder"'), item: Prisma.raw('"GulplazaOrderItem"'), product: Prisma.raw('"GulplazaProduct"') };
}

/** A product counts as sold once its order is delivered, on the day it was delivered (Karachi time). */
export async function getSellerStats(seller: CurrentSeller, rangeDays: StatsRange): Promise<SellerStats> {
  const marketplace = sellerMarketplace(seller);
  const t = tablesFor(marketplace);
  const todayStart = startOfKarachiDay(Date.now());
  // As text with ::timestamp so the value is read as UTC wall time, like the stored timestamps.
  const rangeStart = new Date(todayStart - (rangeDays - 1) * DAY_MS).toISOString();

  const [dailyRows, topRows, statusRows, activeProducts, likes, inCarts] = await Promise.all([
    prisma.$queryRaw<{ day: string; units: number; revenue: number; orders: number }[]>`
      SELECT to_char(COALESCE(o."deliveredAt", o."updatedAt") + interval '5 hours', 'YYYY-MM-DD') AS "day",
             SUM(i."quantity")::int AS "units",
             SUM(i."quantity" * i."price")::float8 AS "revenue",
             COUNT(DISTINCT o."id")::int AS "orders"
      FROM ${t.order} o
      JOIN ${t.item} i ON i."orderId" = o."id"
      WHERE o."sellerId" = ${seller.id}
        AND o."status" = 'DELIVERED'
        AND COALESCE(o."deliveredAt", o."updatedAt") >= ${rangeStart}::timestamp
      GROUP BY 1`,
    prisma.$queryRaw<{ name: string; units: number; revenue: number }[]>`
      SELECT p."name" AS "name",
             SUM(i."quantity")::int AS "units",
             SUM(i."quantity" * i."price")::float8 AS "revenue"
      FROM ${t.order} o
      JOIN ${t.item} i ON i."orderId" = o."id"
      JOIN ${t.product} p ON p."id" = i."productId"
      WHERE o."sellerId" = ${seller.id} AND o."status" = 'DELIVERED'
      GROUP BY p."id", p."name"
      ORDER BY "units" DESC, "revenue" DESC
      LIMIT 8`,
    prisma.$queryRaw<{ status: string; orders: number; units: number; revenue: number }[]>`
      SELECT o."status"::text AS "status",
             COUNT(DISTINCT o."id")::int AS "orders",
             COALESCE(SUM(i."quantity"), 0)::int AS "units",
             COALESCE(SUM(i."quantity" * i."price"), 0)::float8 AS "revenue"
      FROM ${t.order} o
      LEFT JOIN ${t.item} i ON i."orderId" = o."id"
      WHERE o."sellerId" = ${seller.id}
      GROUP BY o."status"`,
    isFoodSeller(seller)
      ? prisma.gulplazaProduct.count({ where: { sellerId: seller.id, isActive: true } })
      : prisma.product.count({ where: { sellerId: seller.id, isActive: true } }),
    isFoodSeller(seller) ? Promise.resolve(null) : prisma.productLike.count({ where: { product: { sellerId: seller.id } } }),
    prisma.cartItem.count({ where: { sellerId: seller.id, marketplace, dismissedAt: null } }),
  ]);

  // One entry per Karachi day in the range, zero where nothing was delivered.
  const byDay = new Map(dailyRows.map((row) => [row.day, row]));
  const days: SalesDay[] = [];

  for (let i = rangeDays - 1; i >= 0; i--) {
    const key = new Date(todayStart - i * DAY_MS + KARACHI_UTC_OFFSET_MS).toISOString().slice(0, 10);
    const row = byDay.get(key);

    days.push({
      date: key,
      label: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      units: row?.units ?? 0,
      revenue: row?.revenue ?? 0,
      orders: row?.orders ?? 0,
    });
  }

  const status = (name: string) => statusRows.find((row) => row.status === name);
  const delivered = status('DELIVERED');

  return {
    rangeDays,
    days,
    topProducts: topRows,
    totals: {
      unitsSold: delivered?.units ?? 0,
      revenue: delivered?.revenue ?? 0,
      deliveredOrders: delivered?.orders ?? 0,
      inProgressOrders: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].reduce(
        (sum, name) => sum + (status(name)?.orders ?? 0),
        0
      ),
      cancelledOrders: status('CANCELLED')?.orders ?? 0,
    },
    activeProducts,
    likes,
    inCarts,
  };
}
