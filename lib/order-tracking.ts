import { prisma } from '@/lib/prisma';
import { isRealLocation, type Coordinates } from '@/lib/geo';
import { withPortionLabel } from '@/lib/food-portions';
import { orderRef, parseOrderRef, trackingPath, type OrderKind } from '@/lib/order-number';
import type { NotifyInput } from '@/lib/notify';
import { getRiderRatings } from '@/lib/rider-orders';
import {
  buildRiderView,
  buildSteps,
  describeProgress,
  isLiveStatus,
  type OrderTracking,
  type TrackItem,
  type TrackStatus,
} from '@/lib/order-tracking-config';

// Live order tracking for the customer: where an order is (its steps, with the time each was reached) and, while a rider
// has taken it, where the rider is. The wording and the arithmetic are in lib/order-tracking-config.ts; this file reads the
// database. The page is app/track/[ref]/page.tsx and it keeps itself up to date from GET /api/track/[ref].

// ── Step times ──────────────────────────────────────────────

/** The column to set along with `status` when an order moves to it, so the timeline knows when each step was reached. */
export function statusStamp(status: string, now: Date = new Date()) {
  switch (status) {
    case 'CONFIRMED':
      return { confirmedAt: now };
    case 'PREPARING':
      return { preparingAt: now };
    case 'OUT_FOR_DELIVERY':
      return { outForDeliveryAt: now };
    case 'CANCELLED':
      return { cancelledAt: now };
    default:
      // PENDING is the order's creation and DELIVERED already has `deliveredAt`, set by the seller's route.
      return {};
  }
}

// ── What the customer is told at each step ──────────────────

/**
 * The notification a customer gets when the seller moves their order on (the bell and a push, both opening the tracking
 * page). All of an order's notices share one `refId`, so while the customer has not looked at the first, the next one
 * replaces it instead of piling up. Delivery has no notice here: it has its own (the rider's "Order delivered", and the points).
 */
export function statusNotice(input: {
  status: string;
  kind: OrderKind;
  ref: string;
  storeName: string;
  orderId: string;
  customerUserId: string;
}): NotifyInput | null {
  const base = { userId: input.customerUserId, type: 'ORDER' as const, href: trackingPath(input.ref), refId: `track:${input.orderId}` };

  switch (input.status) {
    case 'CONFIRMED':
      return { ...base, title: 'Order accepted', message: `${input.storeName} accepted your order ${input.ref}.` };
    case 'PREPARING':
      return {
        ...base,
        title: input.kind === 'gulplaza' ? 'Your food is being prepared' : 'Your order is being packed',
        message: `${input.storeName} is ${input.kind === 'gulplaza' ? 'preparing' : 'packing'} your order ${input.ref}.`,
      };
    case 'OUT_FOR_DELIVERY':
      return { ...base, title: 'Your order is on the way!', message: `${input.ref} has left ${input.storeName}. Follow your rider live.` };
    case 'CANCELLED':
      return { ...base, title: 'Order cancelled', message: `${input.storeName} cancelled your order ${input.ref}.` };
    default:
      return null;
  }
}

// ── The tracking data ───────────────────────────────────────

export type TrackingViewer = { userId: string; role: string };

/** One order of either kind, in the shape the tracking page needs. */
type RawOrder = {
  id: string;
  kind: OrderKind;
  orderNumber: number;
  status: TrackStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  preparingAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  customerId: string;
  customerUserId: string;
  storeName: string;
  storeCoords: Coordinates | null;
  addressText: string;
  addressCoords: Coordinates | null;
  items: TrackItem[];
  itemsTotal: number;
  discount: number;
  delivery: number;
  payment: { method: string | null; status: string | null };
};

const SELLER_SELECT = { businessName: true, latitude: true, longitude: true } as const;

function coordsOf(latitude: number | null, longitude: number | null): Coordinates | null {
  const coords = latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;

  return isRealLocation(coords) ? coords : null;
}

async function loadRawOrder(kind: OrderKind, orderNumber: number): Promise<RawOrder | null> {
  if (kind === 'mart') {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: { include: { product: { select: { name: true } } } },
        seller: { select: SELLER_SELECT },
        address: true,
        payment: true,
        customer: { select: { id: true, userId: true } },
      },
    });

    if (!order) return null;

    return {
      id: order.id,
      kind,
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      preparingAt: order.preparingAt,
      outForDeliveryAt: order.outForDeliveryAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      customerId: order.customer.id,
      customerUserId: order.customer.userId,
      storeName: order.seller.businessName,
      storeCoords: coordsOf(order.seller.latitude, order.seller.longitude),
      addressText: `${order.address.street}, ${order.address.city}`,
      addressCoords: coordsOf(order.address.latitude, order.address.longitude),
      items: order.items.map((item) => ({ id: item.id, name: item.product.name, quantity: item.quantity, price: Number(item.price) })),
      itemsTotal: Number(order.totalAmount),
      discount: Number(order.discountAmount),
      delivery: 0,
      payment: { method: order.payment?.method ?? null, status: order.payment?.status ?? null },
    };
  }

  const order = await prisma.gulplazaOrder.findUnique({
    where: { orderNumber },
    include: {
      items: { include: { product: { select: { name: true } } } },
      seller: { select: SELLER_SELECT },
      address: true,
      payment: true,
      customer: { select: { id: true, userId: true } },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    kind,
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
    preparingAt: order.preparingAt,
    outForDeliveryAt: order.outForDeliveryAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    customerId: order.customer.id,
    customerUserId: order.customer.userId,
    storeName: order.seller.businessName,
    storeCoords: coordsOf(order.seller.latitude, order.seller.longitude),
    addressText: `${order.address.street}, ${order.address.city}`,
    addressCoords: coordsOf(order.address.latitude, order.address.longitude),
    items: order.items.map((item) => ({
      id: item.id,
      name: withPortionLabel(item.product.name, item.portionGrams),
      quantity: item.quantity,
      price: Number(item.price),
    })),
    itemsTotal: Number(order.totalAmount),
    discount: Number(order.discountAmount),
    delivery: Number(order.deliveryFee),
    payment: { method: order.payment?.method ?? null, status: order.payment?.status ?? null },
  };
}

/**
 * Everything the tracking page shows about the order numbered `ref` (MW-F10001), or null when there is no such order or it is not
 * the viewer's: the same answer for both, so order numbers can't be probed. The customer it belongs to and admins may look.
 * While the order is going, and a rider has taken it, this includes where the rider is: only for those two people, and only then.
 */
export async function loadOrderTracking(ref: string, viewer: TrackingViewer, now: Date = new Date()): Promise<OrderTracking | null> {
  const parsed = parseOrderRef(ref);

  if (!parsed) return null;

  const order = await loadRawOrder(parsed.kind, parsed.orderNumber);

  if (!order) return null;
  if (viewer.role !== 'ADMIN' && (viewer.role !== 'CUSTOMER' || order.customerUserId !== viewer.userId)) return null;

  // The customer has one live order chat at a time; its rider is whoever delivers every order that customer has going.
  const chat = isLiveStatus(order.status)
    ? await prisma.riderChat.findFirst({
        where: { customerId: order.customerId, status: { in: ['OPEN', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          riderId: true,
          areaId: true,
          latitude: true,
          longitude: true,
          rider: {
            select: {
              vehicleType: true,
              lastLatitude: true,
              lastLongitude: true,
              locationUpdatedAt: true,
              lastSeenAt: true,
              user: { select: { name: true } },
            },
          },
        },
      })
    : null;
  const rating = chat?.riderId ? ((await getRiderRatings([chat.riderId])).get(chat.riderId) ?? null) : null;

  const dropOffCoords = order.addressCoords ?? (chat ? coordsOf(chat.latitude, chat.longitude) : null);
  const rider = buildRiderView({
    status: order.status,
    chat: chat ? { id: chat.id, status: chat.status, managed: chat.areaId !== null } : null,
    rider: chat?.rider
      ? {
          name: chat.rider.user.name,
          vehicle: chat.rider.vehicleType,
          lat: chat.rider.lastLatitude,
          lng: chat.rider.lastLongitude,
          // Written by the online heartbeat and by the delivery ping; riders from before the column existed only have the heartbeat time.
          locationAt: chat.rider.locationUpdatedAt ?? chat.rider.lastSeenAt,
        }
      : null,
    rating,
    store: order.storeCoords,
    dropOff: dropOffCoords,
    now,
  });
  const { headline, subline } = describeProgress({ status: order.status, kind: order.kind, storeName: order.storeName, rider });

  return {
    ref: orderRef(order.kind, order.orderNumber),
    marketplace: order.kind,
    status: order.status,
    isLive: isLiveStatus(order.status),
    headline,
    subline,
    placedAt: order.createdAt.toISOString(),
    store: { name: order.storeName, coords: order.storeCoords },
    dropOff: { text: order.addressText, coords: dropOffCoords },
    steps: buildSteps({
      status: order.status,
      kind: order.kind,
      storeName: order.storeName,
      placedAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      preparingAt: order.preparingAt,
      outForDeliveryAt: order.outForDeliveryAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
    }),
    rider,
    items: order.items,
    money: {
      items: order.itemsTotal,
      discount: order.discount,
      delivery: order.delivery,
      total: order.itemsTotal - order.discount + order.delivery,
    },
    payment: order.payment,
    serverTime: now.toISOString(),
  };
}

/** The customer's orders that are still going, newest first (each with the link to its tracking page), for the "track your order" strip. */
export async function listLiveOrderLinks(customerId: string) {
  const live = { customerId, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'] as TrackStatus[] } };
  const [mart, food] = await Promise.all([
    prisma.order.findMany({ where: live, orderBy: { createdAt: 'desc' }, take: 10, select: { orderNumber: true, status: true, createdAt: true, seller: { select: { businessName: true } } } }),
    prisma.gulplazaOrder.findMany({ where: live, orderBy: { createdAt: 'desc' }, take: 10, select: { orderNumber: true, status: true, createdAt: true, seller: { select: { businessName: true } } } }),
  ]);

  return [
    ...mart.map((order) => ({ ref: orderRef('mart', order.orderNumber), status: order.status as TrackStatus, storeName: order.seller.businessName, createdAt: order.createdAt })),
    ...food.map((order) => ({ ref: orderRef('gulplaza', order.orderNumber), status: order.status as TrackStatus, storeName: order.seller.businessName, createdAt: order.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map((order) => ({ ref: order.ref, status: order.status, storeName: order.storeName }));
}
