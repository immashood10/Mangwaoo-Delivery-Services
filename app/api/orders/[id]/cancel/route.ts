import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getSellerUserIds, notifyAfterResponse, shortOrderId } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';
import { releaseCouponIfUnused } from '@/lib/coupons';

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'You must be logged in as a customer to do this.' }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true } } },
  });
  if (!customer) {
    return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });

  if (!order || order.customerId !== customer.id) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(order.status)) {
    return NextResponse.json({ error: 'This order can no longer be cancelled.' }, { status: 400 });
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    // The status guard keeps stock from being restored twice if the seller cancels at the same moment.
    const result = await tx.order.updateMany({
      where: { id, status: { in: [...CANCELLABLE_STATUSES] } },
      data: { status: 'CANCELLED' },
    });
    if (result.count === 0) return false;

    for (const item of order.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }

    // A coupon used by this checkout is given back once all its orders are cancelled.
    await releaseCouponIfUnused(tx, order.redemptionId);

    return true;
  });

  if (!cancelled) {
    return NextResponse.json({ error: 'This order can no longer be cancelled.' }, { status: 400 });
  }

  // Let the seller know — a cancelled order moves from Incoming to Completed orders.
  notifyAfterResponse(async () => {
    const userId = (await getSellerUserIds([order.sellerId])).get(order.sellerId);
    if (!userId) return null;

    return {
      userId,
      type: 'ORDER' as const,
      title: 'Order cancelled',
      message: `${customer.user.name} cancelled order #${shortOrderId(order.id)}.`,
      href: SELLER_PAGES.completed,
      refId: `cancel:${order.id}`,
    };
  });

  return NextResponse.json({ success: true });
}
