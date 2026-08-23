import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'You must be logged in as a customer to do this.' }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });

  if (!order || order.customerId !== customer.id) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return NextResponse.json({ error: 'This order can no longer be cancelled.' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } }),
    ...order.items.map((item) =>
      prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    ),
  ]);

  return NextResponse.json({ success: true });
}
