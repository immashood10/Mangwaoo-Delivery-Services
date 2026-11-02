import { prisma } from '@/lib/prisma';
import { orderRef } from '@/lib/order-number';
import { withPortionLabel } from '@/lib/food-portions';
import { notifyAfterResponse } from '@/lib/notify';
import { releaseCouponIfUnused } from '@/lib/coupons';
import { releaseLoyaltyIfUnused } from '@/lib/loyalty-card';
import { refreshFoodCatalog } from '@/lib/catalog-cache';
import { statusNotice, statusStamp } from '@/lib/order-tracking';

export type ShopOwnerOrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

const NEXT: Record<string, ShopOwnerOrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
};

const ACTIVE: { notIn: ('DELIVERED' | 'CANCELLED')[] } = { notIn: ['DELIVERED', 'CANCELLED'] };

export async function listShopOwnerOrders(areaId?: number) {
  const orders = await prisma.gulplazaOrder.findMany({
    where: {
      status: ACTIVE,
      seller: { sellerType: 'SHOP_OWNER' },
      ...(areaId !== undefined ? { riderChat: { is: { areaId } } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      seller: { select: { businessName: true } },
      customer: { select: { user: { select: { name: true } } } },
      address: { select: { street: true, city: true } },
      items: { include: { product: { select: { name: true } } } },
      riderChat: { select: { areaId: true, status: true, rider: { select: { user: { select: { name: true } } } } } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    ref: orderRef('gulplaza', order.orderNumber),
    status: order.status,
    storeName: order.seller.businessName,
    customerName: order.customer.user.name,
    address: `${order.address.street}, ${order.address.city}`,
    riderName: order.riderChat?.rider?.user.name ?? null,
    riderAssigned: order.riderChat?.status === 'ACTIVE',
    createdAt: order.createdAt.toISOString(),
    total: Number(order.totalAmount) - Number(order.discountAmount) + Number(order.deliveryFee),
    items: order.items.map((item) => ({ name: withPortionLabel(item.product.name, item.portionGrams), quantity: item.quantity })),
  }));
}

export async function changeShopOwnerOrderStatus(input: { orderId: string; status: ShopOwnerOrderStatus; areaId?: number }) {
  const order = await prisma.gulplazaOrder.findUnique({
    where: { id: input.orderId },
    include: {
      seller: { select: { businessName: true, sellerType: true } },
      customer: { select: { id: true, userId: true } },
      items: { select: { productId: true, quantity: true } },
      riderChat: { select: { areaId: true, status: true, riderId: true } },
    },
  });

  if (!order || order.seller.sellerType !== 'SHOP_OWNER') return { kind: 'missing' as const };
  if (input.areaId !== undefined && order.riderChat?.areaId !== input.areaId) return { kind: 'missing' as const };
  if (!NEXT[order.status]?.includes(input.status)) return { kind: 'invalid-transition' as const, from: order.status };
  if (input.status === 'OUT_FOR_DELIVERY' && (order.riderChat?.status !== 'ACTIVE' || !order.riderChat.riderId)) return { kind: 'rider-required' as const };

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.gulplazaOrder.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: input.status, ...statusStamp(input.status) },
    });
    if (result.count === 0) return false;

    if (input.status === 'CANCELLED') {
      for (const item of order.items) {
        await tx.gulplazaProduct.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      await releaseCouponIfUnused(tx, order.redemptionId);
      await releaseLoyaltyIfUnused(tx, order.loyaltyRedemptionId);
    }

    return true;
  });

  if (!changed) return { kind: 'conflict' as const };

  const notice = statusNotice({
    status: input.status,
    kind: 'gulplaza',
    ref: orderRef('gulplaza', order.orderNumber),
    storeName: 'Mangwaoo',
    orderId: order.id,
    customerUserId: order.customer.userId,
  });
  if (notice) notifyAfterResponse(async () => notice);
  if (input.status === 'CANCELLED') refreshFoodCatalog();

  return { kind: 'ok' as const };
}
