import { prisma } from '@/lib/prisma';
import { KARACHI_UTC_OFFSET_MS, startOfKarachiDay } from '@/lib/admin-stats';
import { withPortionLabel } from '@/lib/food-portions';
import { orderRef } from '@/lib/order-number';
import { isFoodSeller, type CurrentSeller } from '@/lib/seller-context';

// Numbers for the seller's Dashboard, Sales, Customers, Orders and Reports pages. One query per marketplace loads the
// seller's orders (newest first, at most MAX_ORDERS) and everything else is worked out here, so the pages agree with
// each other. A sale is an order that was DELIVERED; revenue is what the seller earns on it (items, without coupon or
// delivery fee), on the day it was delivered (Karachi time).

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ORDERS = 5000;

export type AnalyticsOrder = {
  id: string;
  ref: string;
  status: string;
  createdAt: Date;
  /** When it counted as sold: the delivery time (or the last change for older orders). */
  soldAt: Date;
  customerId: string;
  customerName: string;
  payment: string | null;
  revenue: number;
  items: { name: string; category: string; quantity: number; price: number }[];
};

export async function loadSellerOrders(seller: CurrentSeller): Promise<AnalyticsOrder[]> {
  const orderBy = { createdAt: 'desc' } as const;
  const where = { sellerId: seller.id };

  if (isFoodSeller(seller)) {
    const orders = await prisma.gulplazaOrder.findMany({
      where,
      orderBy,
      take: MAX_ORDERS,
      include: {
        items: { include: { product: { select: { name: true, category: { select: { name: true } } } } } },
        customer: { include: { user: { select: { name: true } } } },
        payment: { select: { method: true } },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      ref: orderRef('gulplaza', order.orderNumber),
      status: order.status,
      createdAt: order.createdAt,
      soldAt: order.deliveredAt ?? order.updatedAt,
      customerId: order.customerId,
      customerName: order.customer.user.name,
      payment: order.payment?.method ?? null,
      revenue: order.items.reduce((sum, item) => sum + item.quantity * Number(item.price), 0),
      items: order.items.map((item) => ({ name: withPortionLabel(item.product.name, item.portionGrams), category: item.product.category.name, quantity: item.quantity, price: Number(item.price) })),
    }));
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy,
    take: MAX_ORDERS,
    include: {
      items: { include: { product: { select: { name: true, category: { select: { name: true } } } } } },
      customer: { include: { user: { select: { name: true } } } },
      payment: { select: { method: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    ref: orderRef('mart', order.orderNumber),
    status: order.status,
    createdAt: order.createdAt,
    soldAt: order.deliveredAt ?? order.updatedAt,
    customerId: order.customerId,
    customerName: order.customer.user.name,
    payment: order.payment?.method ?? null,
    revenue: order.items.reduce((sum, item) => sum + item.quantity * Number(item.price), 0),
    items: order.items.map((item) => ({ name: item.product.name, category: item.product.category.name, quantity: item.quantity, price: Number(item.price) })),
  }));
}

export const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on delivery',
  CARD: 'Card',
  WALLET: 'Wallet',
  BANK_TRANSFER: 'Bank transfer',
};

export function statusLabel(status: string) {
  if (status === 'DELIVERED') return 'Completed';
  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'OUT_FOR_DELIVERY') return 'On the way';
  if (status === 'PREPARING' || status === 'CONFIRMED') return 'Preparing';
  return 'Pending';
}

/** Percent change from `before` to `now`; null when there was nothing before to compare with. */
export function growth(now: number, before: number) {
  if (before <= 0) return now > 0 ? null : 0;
  return Math.round(((now - before) / before) * 1000) / 10;
}

const karachiMonthKey = (date: Date) => new Date(date.getTime() + KARACHI_UTC_OFFSET_MS).toISOString().slice(0, 7);
const karachiDayKey = (timestamp: number) => new Date(timestamp + KARACHI_UTC_OFFSET_MS).toISOString().slice(0, 10);

function aggregateProducts(sold: AnalyticsOrder[]) {
  const byName = new Map<string, { name: string; category: string; units: number; revenue: number }>();

  for (const order of sold) {
    for (const item of order.items) {
      const entry = byName.get(item.name) ?? { name: item.name, category: item.category, units: 0, revenue: 0 };
      entry.units += item.quantity;
      entry.revenue += item.quantity * item.price;
      byName.set(item.name, entry);
    }
  }

  return [...byName.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units);
}

export function summarizeSales(orders: AnalyticsOrder[], now = Date.now()) {
  const sold = orders.filter((order) => order.status === 'DELIVERED');
  const cancelled = orders.filter((order) => order.status === 'CANCELLED');
  const weekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;
  const inWindow = (time: number, from: number, to: number) => time >= from && time < to;

  const soldThisWeek = sold.filter((order) => inWindow(order.soldAt.getTime(), weekAgo, now));
  const soldLastWeek = sold.filter((order) => inWindow(order.soldAt.getTime(), twoWeeksAgo, weekAgo));
  const sum = (list: AnalyticsOrder[]) => list.reduce((total, order) => total + order.revenue, 0);

  // Active customers: ordered in the last 30 days (anything but a cancelled order). New ones: first order ever in the last 7 days.
  const monthAgo = now - 30 * DAY_MS;
  const active = new Set(orders.filter((order) => order.status !== 'CANCELLED' && order.createdAt.getTime() >= monthAgo).map((order) => order.customerId));
  const firstOrder = new Map<string, number>();

  for (const order of orders) {
    const time = order.createdAt.getTime();
    if (time < (firstOrder.get(order.customerId) ?? Infinity)) firstOrder.set(order.customerId, time);
  }

  const newThisWeek = [...firstOrder.values()].filter((time) => time >= weekAgo).length;
  const newLastWeek = [...firstOrder.values()].filter((time) => inWindow(time, twoWeeksAgo, weekAgo)).length;
  const cancelledThisWeek = cancelled.filter((order) => order.createdAt.getTime() >= weekAgo).length;
  const cancelledLastWeek = cancelled.filter((order) => inWindow(order.createdAt.getTime(), twoWeeksAgo, weekAgo)).length;

  // Last 12 months of revenue (Karachi months)
  const monthKeys: string[] = [];
  const cursor = new Date(now + KARACHI_UTC_OFFSET_MS);

  for (let i = 11; i >= 0; i--) {
    monthKeys.push(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }

  const months = monthKeys.map((key) => ({
    key,
    label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    fullLabel: new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    sales: 0,
    revenue: 0,
  }));
  const monthByKey = new Map(months.map((month) => [month.key, month]));

  for (const order of sold) {
    const month = monthByKey.get(karachiMonthKey(order.soldAt));
    if (month) {
      month.sales += 1;
      month.revenue += order.revenue;
    }
  }

  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];

  // Where the money came from (payment method) and what earned it
  const byPayment = new Map<string, number>();
  for (const order of sold) byPayment.set(order.payment ?? 'OTHER', (byPayment.get(order.payment ?? 'OTHER') ?? 0) + order.revenue);

  const totalRevenue = sum(sold);
  const payments = [...byPayment.entries()]
    .map(([method, revenue]) => ({ method, label: PAYMENT_LABELS[method] ?? 'Other', revenue, percent: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
  const products = aggregateProducts(sold).map((product) => ({ ...product, percent: totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0 }));

  // Daily revenue of the last 30 days
  const todayStart = startOfKarachiDay(now);
  const days = Array.from({ length: 30 }, (_, index) => {
    const key = karachiDayKey(todayStart - (29 - index) * DAY_MS);
    return { key, label: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), sales: 0, revenue: 0 };
  });
  const dayByKey = new Map(days.map((day) => [day.key, day]));

  for (const order of sold) {
    const day = dayByKey.get(karachiDayKey(order.soldAt.getTime()));
    if (day) {
      day.sales += 1;
      day.revenue += order.revenue;
    }
  }

  const finished = sold.length + cancelled.length;

  return {
    totals: { sales: sold.length, revenue: totalRevenue, orders: orders.length, cancelled: cancelled.length, activeCustomers: active.size },
    changes: {
      sales: growth(soldThisWeek.length, soldLastWeek.length),
      revenue: growth(sum(soldThisWeek), sum(soldLastWeek)),
      customers: growth(newThisWeek, newLastWeek),
      cancelled: growth(cancelledThisWeek, cancelledLastWeek),
      month: growth(thisMonth.revenue, lastMonth.revenue),
    },
    newCustomersThisWeek: newThisWeek,
    successRate: finished > 0 ? Math.round((sold.length / finished) * 1000) / 10 : null,
    months,
    yearRevenue: months.reduce((total, month) => total + month.revenue, 0),
    days,
    payments,
    products,
  };
}

export type CustomerRow = { id: string; name: string; orders: number; delivered: number; spent: number; lastOrder: Date };

export function summarizeCustomers(orders: AnalyticsOrder[]): CustomerRow[] {
  const byCustomer = new Map<string, CustomerRow>();

  for (const order of orders) {
    const row = byCustomer.get(order.customerId) ?? { id: order.customerId, name: order.customerName, orders: 0, delivered: 0, spent: 0, lastOrder: order.createdAt };
    if (order.status !== 'CANCELLED') row.orders += 1;
    if (order.status === 'DELIVERED') {
      row.delivered += 1;
      row.spent += order.revenue;
    }
    if (order.createdAt > row.lastOrder) row.lastOrder = order.createdAt;
    byCustomer.set(order.customerId, row);
  }

  return [...byCustomer.values()].sort((a, b) => b.spent - a.spent || b.orders - a.orders);
}

export type OrderFilter = { q?: string; status?: string; category?: string };

export function filterOrders(orders: AnalyticsOrder[], filter: OrderFilter) {
  const q = (filter.q ?? '').trim().toLowerCase();

  return orders.filter((order) => {
    if (filter.status && statusLabel(order.status) !== filter.status) return false;
    if (filter.category && !order.items.some((item) => item.category === filter.category)) return false;
    if (!q) return true;

    return (
      order.ref.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      order.items.some((item) => item.name.toLowerCase().includes(q))
    );
  });
}

export const ORDER_STATUS_FILTERS = ['Pending', 'Preparing', 'On the way', 'Completed', 'Cancelled'] as const;

export function categoriesOf(orders: AnalyticsOrder[]) {
  return [...new Set(orders.flatMap((order) => order.items.map((item) => item.category)))].sort();
}

export function productsLabel(order: AnalyticsOrder) {
  const [first, ...rest] = order.items;
  if (!first) return 'No items';
  return rest.length > 0 ? `${first.name} (+${rest.length} more)` : first.name;
}
