import { prisma } from '@/lib/prisma';
import { areaForPoint, areaName } from '@/lib/area-managers-config';
import { areasWithManagers } from '@/lib/area-managers';
import { refreshFoodCatalog, refreshMartCatalog } from '@/lib/catalog-cache';
import { releaseCouponIfUnused } from '@/lib/coupons';
import { withPortionLabel } from '@/lib/food-portions';
import { isRealLocation, type Coordinates } from '@/lib/geo';
import { ensureLoyaltyInvitation, releaseLoyaltyIfUnused } from '@/lib/loyalty-card';
import { SELLER_PAGES } from '@/lib/notification-types';
import { notifyAfterResponse } from '@/lib/notify';
import { orderRef } from '@/lib/order-number';
import { statusNotice, statusStamp } from '@/lib/order-tracking';
import { awardOrderPoints, type OrderKindKey } from '@/lib/points';

// Who moves an order along (accept -> preparing -> out for delivery -> delivered) or cancels it: an admin, the area's Area Sales
// Manager, and the vendor when it is a small business owner. A SHOP OWNER (`SHOP_OWNER`) changes nothing: they receive the order,
// make it, and are told when it has been handed over and when the rider has delivered it. Nobody sees the customer through a vendor.
// An order belongs to the area whose manager is nearest to where it is delivered (the drop-off pin of its address, else the
// vendor's own pin), the same "nearest area that has a manager, within 10 km" rule the Chat orders follow.

export type FulfillmentKind = 'MART' | 'GULPLAZA';
export type FulfillmentStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

/** The steps an order can take. Cancelling is possible until it is out for delivery. */
export const NEXT_STATUSES: Record<string, FulfillmentStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
};

const ACTIVE_STATUSES: FulfillmentStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];
const FINISHED_VISIBLE_MS = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 300;

export type FulfillmentOrder = {
  id: string;
  kind: FulfillmentKind;
  ref: string;
  status: FulfillmentStatus;
  storeName: string;
  customerName: string;
  address: string;
  note: string | null;
  items: { name: string; quantity: number }[];
  /** What the customer pays: items - discount + delivery fee (food). */
  total: number;
  createdAt: string;
  paymentMethod: string | null;
  /** The rider on this order's delivery chat, when one has taken it. */
  riderName: string | null;
  riderAssigned: boolean;
  /** The Area Sales Manager's area this order belongs to; null = no manager covers it (only admins handle it). */
  areaId: number | null;
  areaName: string | null;
};

type Point = Coordinates | null;

function pointOf(address: { latitude: number | null; longitude: number | null }, seller: { latitude: number | null; longitude: number | null }): Point {
  const drop = { lat: address.latitude ?? NaN, lng: address.longitude ?? NaN };

  if (isRealLocation(drop)) return drop;

  const shop = { lat: seller.latitude ?? NaN, lng: seller.longitude ?? NaN };

  return isRealLocation(shop) ? shop : null;
}

function areaOf(point: Point, covered: number[]): number | null {
  return point ? areaForPoint(point, covered) : null;
}

const INCLUDE = {
  seller: { select: { businessName: true, latitude: true, longitude: true, userId: true } },
  customer: { select: { id: true, userId: true, user: { select: { name: true } } } },
  address: { select: { street: true, city: true, latitude: true, longitude: true } },
  payment: { select: { method: true } },
  riderChat: { select: { status: true, riderId: true, rider: { select: { user: { select: { name: true } } } } } },
} as const;

/**
 * The orders an admin (no `areaId`: every order) or an area's manager (`areaId`: only the orders of that area) deals with: the
 * ones still going, plus those finished in the last day. Newest waiting first is left to the caller; here the oldest active comes first.
 */
export async function listFulfillmentOrders(areaId?: number): Promise<FulfillmentOrder[]> {
  const since = new Date(Date.now() - FINISHED_VISIBLE_MS);
  const where = { OR: [{ status: { in: ACTIVE_STATUSES } }, { updatedAt: { gte: since } }] };
  const [mart, food, covered] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { ...INCLUDE, items: { include: { product: { select: { name: true } } } } },
    }),
    prisma.gulplazaOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
      include: { ...INCLUDE, items: { include: { product: { select: { name: true } } } } },
    }),
    areasWithManagers(),
  ]);

  const rows: FulfillmentOrder[] = [
    ...mart.map((order) => ({
      id: order.id,
      kind: 'MART' as const,
      ref: orderRef('mart', order.orderNumber),
      status: order.status as FulfillmentStatus,
      storeName: order.seller.businessName,
      customerName: order.customer.user.name,
      address: `${order.address.street}, ${order.address.city}`,
      note: order.note,
      items: order.items.map((item) => ({ name: item.product.name, quantity: item.quantity })),
      total: Number(order.totalAmount) - Number(order.discountAmount),
      createdAt: order.createdAt.toISOString(),
      paymentMethod: order.payment?.method ?? null,
      riderName: order.riderChat?.rider?.user.name ?? null,
      riderAssigned: order.riderChat?.status === 'ACTIVE' && !!order.riderChat.riderId,
      areaId: areaOf(pointOf(order.address, order.seller), covered),
    })),
    ...food.map((order) => ({
      id: order.id,
      kind: 'GULPLAZA' as const,
      ref: orderRef('gulplaza', order.orderNumber),
      status: order.status as FulfillmentStatus,
      storeName: order.seller.businessName,
      customerName: order.customer.user.name,
      address: `${order.address.street}, ${order.address.city}`,
      note: order.note,
      items: order.items.map((item) => ({ name: withPortionLabel(item.product.name, item.portionGrams), quantity: item.quantity })),
      total: Number(order.totalAmount) - Number(order.discountAmount) + Number(order.deliveryFee),
      createdAt: order.createdAt.toISOString(),
      paymentMethod: order.payment?.method ?? null,
      riderName: order.riderChat?.rider?.user.name ?? null,
      riderAssigned: order.riderChat?.status === 'ACTIVE' && !!order.riderChat.riderId,
      areaId: areaOf(pointOf(order.address, order.seller), covered),
    })),
  ]
    .filter((row) => areaId === undefined || row.areaId === areaId)
    .map((row) => ({ ...row, areaName: row.areaId === null ? null : areaName(row.areaId) }));

  // Waiting orders first (oldest first), then the others by how recent they are.
  const rank: Record<string, number> = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, OUT_FOR_DELIVERY: 3, DELIVERED: 4, CANCELLED: 4 };

  return rows.sort((a, b) => rank[a.status] - rank[b.status] || (rank[a.status] <= 3 ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
}

export type ChangeOutcome =
  | { kind: 'ok'; status: FulfillmentStatus }
  | { kind: 'missing' }
  | { kind: 'invalid-transition'; from: string }
  | { kind: 'rider-required' }
  | { kind: 'conflict' };

async function awardPoints(kind: OrderKindKey, orderId: string) {
  try {
    const result = await awardOrderPoints(kind, orderId);

    if (!result.awarded) return;

    notifyAfterResponse(async () => ({
      userId: result.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'You won Mangwaoo Points!',
      message: `${result.points} points for your delivered order ${result.ref}. You have ${result.totalPoints.toLocaleString('en-PK')} points now.`,
      href: '/account/points',
      refId: `points:${orderId}`,
    }));
  } catch (error) {
    console.error('Could not award Mangwaoo Points:', error);
  }
}

async function inviteToLoyaltyCard(customerId: string) {
  try {
    const invite = await ensureLoyaltyInvitation(customerId);

    if (!invite.invited) return;

    notifyAfterResponse(async () => ({
      userId: invite.customerUserId,
      type: 'ACCOUNT' as const,
      title: 'Apply for your Loyalty Card',
      message: `You have had ${invite.ordersRequired} orders delivered! You can now apply for the Mangwaoo Loyalty Card and get a surprise discount on every order.`,
      href: '/account/loyalty-card',
      refId: `loyalty-card:invite:${customerId}`,
    }));
  } catch (error) {
    console.error('Could not invite to the Loyalty Card:', error);
  }
}

/**
 * Moves an order to `status` as an admin (no `areaId`), as the manager of `areaId` (an order of another area answers "missing"),
 * or as the vendor itself (`sellerId`: only their own orders, and only a small business owner may: the route checks). Staff cannot
 * send an order out before the rider on its chat has taken it. The customer is told at each step, the vendor is told what staff did
 * (not what they did themselves), and a delivered order wins its customer Points.
 */
export async function changeOrderStatus(input: { kind: FulfillmentKind; id: string; status: FulfillmentStatus; areaId?: number; sellerId?: string }): Promise<ChangeOutcome> {
  const mart = input.kind === 'MART';
  const order = mart
    ? await prisma.order.findUnique({ where: { id: input.id }, include: { ...INCLUDE, items: { select: { productId: true, quantity: true } } } })
    : await prisma.gulplazaOrder.findUnique({ where: { id: input.id }, include: { ...INCLUDE, items: { select: { productId: true, quantity: true } } } });

  if (!order) return { kind: 'missing' };

  // A vendor can only move their own orders.
  if (input.sellerId !== undefined && order.sellerId !== input.sellerId) return { kind: 'missing' };

  if (input.areaId !== undefined && areaOf(pointOf(order.address, order.seller), await areasWithManagers()) !== input.areaId) {
    return { kind: 'missing' };
  }

  if (!NEXT_STATUSES[order.status]?.includes(input.status)) return { kind: 'invalid-transition', from: order.status };

  if (input.sellerId === undefined && input.status === 'OUT_FOR_DELIVERY' && order.riderChat && (order.riderChat.status !== 'ACTIVE' || !order.riderChat.riderId)) {
    return { kind: 'rider-required' };
  }

  const changed = await prisma.$transaction(async (tx) => {
    const data = { status: input.status, ...statusStamp(input.status), ...(input.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) };
    const result = mart
      ? await tx.order.updateMany({ where: { id: order.id, status: order.status }, data })
      : await tx.gulplazaOrder.updateMany({ where: { id: order.id, status: order.status }, data });

    // The status guard stops a double click (or the customer cancelling at the same moment) from applying twice.
    if (result.count === 0) return false;

    if (input.status === 'CANCELLED') {
      for (const item of order.items) {
        if (mart) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        else await tx.gulplazaProduct.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }

      await releaseCouponIfUnused(tx, order.redemptionId);
      await releaseLoyaltyIfUnused(tx, order.loyaltyRedemptionId);
    }

    return true;
  });

  if (!changed) return { kind: 'conflict' };

  const kindKey = mart ? 'mart' : 'gulplaza';
  const ref = orderRef(kindKey, order.orderNumber);
  const notice = statusNotice({
    status: input.status,
    kind: kindKey,
    ref,
    storeName: order.seller.businessName,
    orderId: order.id,
    customerUserId: order.customer.userId,
  });

  if (notice) notifyAfterResponse(async () => notice);

  // The vendor sees what Mangwaoo's team did with their order (one notice per order, replaced by the next step while unread).
  if (input.sellerId === undefined) {
    notifyAfterResponse(async () => ({
      userId: order.seller.userId,
      type: 'ORDER' as const,
      title: 'Order update',
      message: `Order ${ref} is now ${input.status.toLowerCase().replace(/_/g, ' ')}.`,
      href: input.status === 'DELIVERED' || input.status === 'CANCELLED' ? SELLER_PAGES.completed : SELLER_PAGES.orders,
      refId: `order-status:${order.id}`,
    }));
  }

  if (input.status === 'CANCELLED') {
    if (mart) refreshMartCatalog();
    else refreshFoodCatalog();
  }

  if (input.status === 'DELIVERED') {
    await awardPoints(mart ? 'MART' : 'GULPLAZA', order.id);
    await inviteToLoyaltyCard(order.customerId);
  }

  return { kind: 'ok', status: input.status };
}

/** The sentence an admin or manager sees for a refused change. */
export function outcomeError(outcome: Exclude<ChangeOutcome, { kind: 'ok' }>, status: string): { status: number; error: string } {
  const describe = (value: string) => value.toLowerCase().replace(/_/g, ' ');

  switch (outcome.kind) {
    case 'missing':
      return { status: 404, error: 'Order not found.' };
    case 'invalid-transition':
      return { status: 400, error: `A ${describe(outcome.from)} order can't be moved to ${describe(status)}.` };
    case 'rider-required':
      return { status: 409, error: 'A rider must take this order before it can go out for delivery.' };
    case 'conflict':
      return { status: 409, error: 'This order was just updated. Please refresh.' };
  }
}

/**
 * The rider (or the customer) finished the delivery, which marks the order(s) of that delivery chat delivered: tell each vendor, so
 * a shop owner who changes nothing themselves still learns the order reached the customer.
 */
export async function notifyVendorsOfDelivery(orders: { kind: FulfillmentKind; id: string }[]) {
  if (orders.length === 0) return;

  const mart = orders.filter((order) => order.kind === 'MART').map((order) => order.id);
  const food = orders.filter((order) => order.kind === 'GULPLAZA').map((order) => order.id);
  const [martRows, foodRows] = await Promise.all([
    prisma.order.findMany({ where: { id: { in: mart } }, select: { id: true, orderNumber: true, seller: { select: { userId: true } } } }),
    prisma.gulplazaOrder.findMany({ where: { id: { in: food } }, select: { id: true, orderNumber: true, seller: { select: { userId: true } } } }),
  ]);

  notifyAfterResponse(async () =>
    [
      ...martRows.map((order) => ({ id: order.id, ref: orderRef('mart', order.orderNumber), userId: order.seller.userId })),
      ...foodRows.map((order) => ({ id: order.id, ref: orderRef('gulplaza', order.orderNumber), userId: order.seller.userId })),
    ].map((order) => ({
      userId: order.userId,
      type: 'ORDER' as const,
      title: 'Order delivered',
      message: `Order ${order.ref} was delivered to the customer.`,
      href: SELLER_PAGES.completed,
      refId: `order-status:${order.id}`,
    }))
  );
}
