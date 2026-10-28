import { prisma } from '@/lib/prisma';
import { orderRef } from '@/lib/order-number';
import { activeBanWhere } from '@/lib/bans';
import { KARACHI_UTC_OFFSET_MS, startOfKarachiDay } from '@/lib/admin-stats';

// Numbers for the super admin's overview page (/admin/super). Money is PKR. "Sales" = what customers paid for orders that
// were not cancelled (items - coupon + the food delivery fee), from MangwaooMart and food orders together.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const SUPER_RANGES = [7, 14, 30] as const;
export type SuperRange = (typeof SUPER_RANGES)[number];

export function parseSuperRange(value: string | undefined): SuperRange {
  const parsed = Number(value);
  return (SUPER_RANGES as readonly number[]).includes(parsed) ? (parsed as SuperRange) : 7;
}

// Accounts that finished signing up and were not deleted: the ones the cards count.
const LIVE_ACCOUNT = { phoneVerifiedAt: { not: null }, deletedAt: null } as const;
const NOT_CANCELLED = { status: { not: 'CANCELLED' } } as const;

type Money = { totalAmount: unknown; discountAmount: unknown; deliveryFee?: unknown };
const paid = (order: Money) => Number(order.totalAmount) - Number(order.discountAmount) + Number(order.deliveryFee ?? 0);

/** Percent change from `before` to `now`; null when there was nothing before to compare with. */
export function growth(now: number, before: number) {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 1000) / 10;
}

export type OrderStatusLabel = 'Completed' | 'Processing' | 'On the way' | 'Cancelled';

function statusLabel(status: string): OrderStatusLabel {
  if (status === 'DELIVERED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'OUT_FOR_DELIVERY') return 'On the way';
  return 'Processing';
}

function karachiDayKey(timestamp: number) {
  return new Date(timestamp + KARACHI_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

async function salesBetween(from: Date, to: Date) {
  const where = { ...NOT_CANCELLED, createdAt: { gte: from, lt: to } };
  const [mart, food] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { totalAmount: true, discountAmount: true }, _count: true }),
    prisma.gulplazaOrder.aggregate({ where, _sum: { totalAmount: true, discountAmount: true, deliveryFee: true }, _count: true }),
  ]);

  return {
    sales: paid({ totalAmount: mart._sum.totalAmount ?? 0, discountAmount: mart._sum.discountAmount ?? 0 }) + paid({ totalAmount: food._sum.totalAmount ?? 0, discountAmount: food._sum.discountAmount ?? 0, deliveryFee: food._sum.deliveryFee ?? 0 }),
    orders: mart._count + food._count,
  };
}

export async function getSuperAdminData(rangeDays: SuperRange) {
  const now = Date.now();
  const todayStart = startOfKarachiDay(now);
  const rangeStart = new Date(todayStart - (rangeDays - 1) * DAY_MS);
  const weekAgo = new Date(now - WEEK_MS);
  const twoWeeksAgo = new Date(now - 2 * WEEK_MS);
  const nowDate = new Date(now);

  const [
    allSales,
    thisWeek,
    lastWeek,
    vendors,
    vendorsThisWeek,
    vendorsLastWeek,
    customers,
    customersThisWeek,
    customersLastWeek,
    riders,
    martProducts,
    foodProducts,
    productsThisWeek,
    productsLastWeek,
    bans,
    martOrdersInRange,
    foodOrdersInRange,
    recentMart,
    recentFood,
    martBySeller,
    foodBySeller,
    recentUsers,
    commission,
    owed,
    disputes,
    bonuses,
  ] = await Promise.all([
    salesBetween(new Date(0), nowDate),
    salesBetween(weekAgo, nowDate),
    salesBetween(twoWeeksAgo, weekAgo),
    prisma.seller.findMany({ where: { user: LIVE_ACCOUNT }, select: { userId: true, isApproved: true } }),
    prisma.seller.count({ where: { user: LIVE_ACCOUNT, createdAt: { gte: weekAgo } } }),
    prisma.seller.count({ where: { user: LIVE_ACCOUNT, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.customer.count({ where: { user: LIVE_ACCOUNT } }),
    prisma.customer.count({ where: { user: { ...LIVE_ACCOUNT, createdAt: { gte: weekAgo } } } }),
    prisma.customer.count({ where: { user: { ...LIVE_ACCOUNT, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } } }),
    prisma.rider.count({ where: { user: LIVE_ACCOUNT } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.gulplazaProduct.count({ where: { isActive: true } }),
    Promise.all([prisma.product.count({ where: { isActive: true, createdAt: { gte: weekAgo } } }), prisma.gulplazaProduct.count({ where: { isActive: true, createdAt: { gte: weekAgo } } })]),
    Promise.all([prisma.product.count({ where: { isActive: true, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }), prisma.gulplazaProduct.count({ where: { isActive: true, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } })]),
    prisma.userBan.findMany({ where: activeBanWhere(), select: { userId: true } }),
    prisma.order.findMany({ where: { ...NOT_CANCELLED, createdAt: { gte: rangeStart } }, select: { createdAt: true, totalAmount: true, discountAmount: true } }),
    prisma.gulplazaOrder.findMany({ where: { ...NOT_CANCELLED, createdAt: { gte: rangeStart } }, select: { createdAt: true, totalAmount: true, discountAmount: true, deliveryFee: true } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, orderNumber: true, status: true, createdAt: true, totalAmount: true, discountAmount: true, seller: { select: { businessName: true } } } }),
    prisma.gulplazaOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, orderNumber: true, status: true, createdAt: true, totalAmount: true, discountAmount: true, deliveryFee: true, seller: { select: { businessName: true } } } }),
    prisma.order.groupBy({ by: ['sellerId'], where: NOT_CANCELLED, _sum: { totalAmount: true, discountAmount: true }, _count: true }),
    prisma.gulplazaOrder.groupBy({ by: ['sellerId'], where: NOT_CANCELLED, _sum: { totalAmount: true, discountAmount: true, deliveryFee: true }, _count: true }),
    prisma.user.findMany({
      where: { ...LIVE_ACCOUNT, role: { not: 'ADMIN' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true, seller: { select: { isApproved: true } }, rider: { select: { isApproved: true } } },
    }),
    prisma.riderLedgerEntry.aggregate({ where: { type: 'COMMISSION' }, _sum: { amount: true } }),
    prisma.rider.aggregate({ where: { walletBalance: { lt: 0 }, user: { deletedAt: null } }, _sum: { walletBalance: true } }),
    prisma.riderOrderRecord.count({ where: { complaint: { not: null }, complaintResolvedAt: null } }),
    // What the riders' delivery bonuses have cost Mangwaoo (positive money lines on the riders' side)
    prisma.riderLedgerEntry.aggregate({ where: { type: 'BONUS' }, _sum: { amount: true } }),
  ]);

  // Daily sales for the chart (Karachi days)
  const days = Array.from({ length: rangeDays }, (_, index) => {
    const start = todayStart - (rangeDays - 1 - index) * DAY_MS;
    const key = karachiDayKey(start);
    return { key, label: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), sales: 0, orders: 0 };
  });
  const dayByKey = new Map(days.map((day) => [day.key, day]));

  for (const order of [...martOrdersInRange, ...foodOrdersInRange]) {
    const day = dayByKey.get(karachiDayKey(order.createdAt.getTime()));
    if (day) {
      day.sales += paid(order);
      day.orders += 1;
    }
  }

  // Vendors: active / waiting for approval / banned
  const bannedUserIds = new Set(bans.map((ban) => ban.userId));
  const vendorCounts = { active: 0, pending: 0, banned: 0 };

  for (const vendor of vendors) {
    if (bannedUserIds.has(vendor.userId)) vendorCounts.banned += 1;
    else if (vendor.isApproved) vendorCounts.active += 1;
    else vendorCounts.pending += 1;
  }

  // Recent orders from both kinds, newest first
  const recentOrders = [...recentMart.map((order) => ({ ...order, ref: orderRef('mart', order.orderNumber) })), ...recentFood.map((order) => ({ ...order, ref: orderRef('gulplaza', order.orderNumber) }))]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6)
    .map((order) => ({
      id: order.id,
      ref: order.ref,
      vendor: order.seller.businessName,
      amount: paid(order),
      createdAt: order.createdAt.toISOString(),
      status: statusLabel(order.status),
    }));

  // Top vendors by sales, both kinds together
  const bySeller = new Map<string, { sales: number; orders: number }>();

  for (const row of [...martBySeller, ...foodBySeller]) {
    const entry = bySeller.get(row.sellerId) ?? { sales: 0, orders: 0 };
    entry.sales += paid({ totalAmount: row._sum.totalAmount ?? 0, discountAmount: row._sum.discountAmount ?? 0, deliveryFee: 'deliveryFee' in row._sum ? row._sum.deliveryFee ?? 0 : 0 });
    entry.orders += row._count;
    bySeller.set(row.sellerId, entry);
  }

  const topIds = [...bySeller.entries()].sort((a, b) => b[1].sales - a[1].sales).slice(0, 5);
  const topSellers = await prisma.seller.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, businessName: true } });
  const nameById = new Map(topSellers.map((seller) => [seller.id, seller.businessName]));

  const products = martProducts + foodProducts;

  return {
    rangeDays,
    totals: {
      sales: allSales.sales,
      orders: allSales.orders,
      vendors: vendors.length,
      customers,
      riders,
      products,
    },
    growth: {
      sales: growth(thisWeek.sales, lastWeek.sales),
      orders: growth(thisWeek.orders, lastWeek.orders),
      vendors: growth(vendorsThisWeek, vendorsLastWeek),
      customers: growth(customersThisWeek, customersLastWeek),
      products: growth(productsThisWeek[0] + productsThisWeek[1], productsLastWeek[0] + productsLastWeek[1]),
    },
    days,
    rangeSales: days.reduce((sum, day) => sum + day.sales, 0),
    vendorCounts,
    recentOrders,
    topVendors: topIds.map(([id, entry]) => ({ id, name: nameById.get(id) ?? 'Vendor', sales: entry.sales, orders: entry.orders })),
    recentUsers: recentUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      pending: (user.role === 'SELLER' && user.seller?.isApproved === false) || (user.role === 'RIDER' && user.rider?.isApproved === false),
    })),
    system: {
      // What Mangwaoo earned: the commission taken from riders (stored as negative money lines on the riders' side)
      revenue: Math.abs(commission._sum.amount ?? 0),
      owedByRiders: Math.abs(owed._sum.walletBalance ?? 0),
      bonusesPaid: bonuses._sum.amount ?? 0,
      openComplaints: disputes,
    },
  };
}
