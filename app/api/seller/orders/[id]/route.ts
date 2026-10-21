import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveSellerApi } from '@/lib/seller-api';
import { refreshFoodCatalog, refreshMartCatalog } from '@/lib/catalog-cache';
import { FINISHED_STATUSES } from '@/lib/seller-types';
import { releaseCouponIfUnused } from '@/lib/coupons';

// What a seller can do with an order at each step. Cancelling is possible until it is out for delivery.
const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
};

type OrderStatusValue = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

function readMarketplace(value: unknown) {
  return value === 'GULPLAZA' ? 'GULPLAZA' : value === 'MART' ? 'MART' : null;
}

function describe(status: string) {
  return status.toLowerCase().replace(/_/g, ' ');
}

// Moves an order to its next step (accept → prepare → out for delivery → delivered) or cancels it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { seller } = resolved;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const marketplace = readMarketplace(body?.marketplace);
  const status = typeof body?.status === 'string' ? (body.status as OrderStatusValue) : null;

  if (!marketplace || !status) {
    return NextResponse.json({ error: 'Choose an order and the status to move it to.' }, { status: 400 });
  }

  const notFound = () => NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const notAllowed = (from: string) =>
    NextResponse.json({ error: `A ${describe(from)} order can't be moved to ${describe(status)}.` }, { status: 400 });
  const conflict = () =>
    NextResponse.json({ error: 'This order was just updated. Please refresh.' }, { status: 409 });

  if (marketplace === 'MART') {
    const order = await prisma.order.findFirst({ where: { id, sellerId: seller.id }, include: { items: true } });
    if (!order) return notFound();
    if (!NEXT_STATUSES[order.status]?.includes(status)) return notAllowed(order.status);

    const changed = await prisma.$transaction(async (tx) => {
      // The status guard stops a double click (or the customer cancelling at the same moment) from applying twice.
      const result = await tx.order.updateMany({
        where: { id, sellerId: seller.id, status: order.status },
        data: { status, ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) },
      });
      if (result.count === 0) return false;

      if (status === 'CANCELLED') {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }

        await releaseCouponIfUnused(tx, order.redemptionId);
      }

      return true;
    });

    if (!changed) return conflict();
    if (status === 'CANCELLED') refreshMartCatalog();

    return NextResponse.json({ order: { id, status } });
  }

  const order = await prisma.gulplazaOrder.findFirst({ where: { id, sellerId: seller.id }, include: { items: true } });
  if (!order) return notFound();
  if (!NEXT_STATUSES[order.status]?.includes(status)) return notAllowed(order.status);

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.gulplazaOrder.updateMany({
      where: { id, sellerId: seller.id, status: order.status },
      data: { status, ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) },
    });
    if (result.count === 0) return false;

    if (status === 'CANCELLED') {
      for (const item of order.items) {
        await tx.gulplazaProduct.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }

      await releaseCouponIfUnused(tx, order.redemptionId);
    }

    return true;
  });

  if (!changed) return conflict();
  if (status === 'CANCELLED') refreshFoodCatalog();

  return NextResponse.json({ order: { id, status } });
}

// Removes a finished (delivered or cancelled) order from the seller's own list. The customer keeps their order history.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await resolveSellerApi();
  if ('error' in resolved) return resolved.error;
  const { seller } = resolved;
  const { id } = await params;

  const marketplace = readMarketplace(request.nextUrl.searchParams.get('marketplace'));

  if (!marketplace) {
    return NextResponse.json({ error: 'Choose which order to remove.' }, { status: 400 });
  }

  const where = { id, sellerId: seller.id, status: { in: [...FINISHED_STATUSES] } };
  const result =
    marketplace === 'MART'
      ? await prisma.order.updateMany({ where, data: { sellerHidden: true } })
      : await prisma.gulplazaOrder.updateMany({ where, data: { sellerHidden: true } });

  if (result.count === 0) {
    return NextResponse.json({ error: 'Only delivered or cancelled orders can be removed.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
