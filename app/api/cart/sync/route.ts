import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type SyncedItem = {
  productId: string;
  sellerId: string;
  marketplace: 'MART' | 'GULPLAZA';
  name: string;
  price: number;
  quantity: number;
};

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json({ error: 'Please log in as a customer to do this.' }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  const items: SyncedItem[] = rawItems
    .map((item: unknown) => {
      const record = item as Record<string, unknown>;
      return {
        productId: typeof record?.productId === 'string' ? record.productId : '',
        sellerId: typeof record?.sellerId === 'string' ? record.sellerId : '',
        marketplace: record?.marketplace === 'GULPLAZA' ? ('GULPLAZA' as const) : ('MART' as const),
        name: typeof record?.name === 'string' ? record.name : '',
        price: typeof record?.price === 'number' ? record.price : 0,
        quantity: typeof record?.quantity === 'number' ? record.quantity : 0,
      };
    })
    .filter((item: SyncedItem) => item.productId && item.sellerId && item.name && item.quantity > 0);

  // The client sends its full current cart every time, so the simplest
  // correct sync is to wholesale-replace this customer's mirror with it.
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { customerId: customer.id } }),
    ...(items.length > 0
      ? [
          prisma.cartItem.createMany({
            data: items.map((item) => ({
              customerId: customer.id,
              sellerId: item.sellerId,
              marketplace: item.marketplace,
              productId: item.productId,
              productName: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true });
}
