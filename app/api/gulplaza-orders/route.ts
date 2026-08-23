import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendWhatsAppNotification } from '@/lib/whatsapp';

type OrderItemInput = { productId: string; qty: number; name?: string; price?: string };

const PAYMENT_METHOD_MAP: Record<string, 'CASH_ON_DELIVERY' | 'WALLET'> = {
  cod: 'CASH_ON_DELIVERY',
  easypaisa_jazzcash: 'WALLET',
};

class InsufficientStockError extends Error {
  constructor(public productName: string, public available: number) {
    super(`Not enough stock for ${productName}`);
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    return NextResponse.json(
      { error: 'Please log in as a customer to place an order.', requiresLogin: true },
      { status: 401 }
    );
  }

  const customer = await prisma.customer.findUnique({ where: { userId: session.userId } });

  if (!customer) {
    return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  const items: OrderItemInput[] = Array.isArray(body?.items)
    ? body.items
        .map((item: unknown) => {
          const record = item as Record<string, unknown>;
          const productId = typeof record?.productId === 'string' ? record.productId : '';
          const qty =
            typeof record?.qty === 'number' ? record.qty : parseInt(String(record?.qty ?? ''), 10);
          const name = typeof record?.name === 'string' ? record.name : undefined;
          const price = typeof record?.price === 'string' ? record.price : undefined;
          return { productId, qty, name, price };
        })
        .filter((item: OrderItemInput) => item.productId && Number.isFinite(item.qty) && item.qty > 0)
    : [];

  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const contactNumber = typeof body?.contactNumber === 'string' ? body.contactNumber.trim() : '';
  const completeAddress = typeof body?.completeAddress === 'string' ? body.completeAddress.trim() : '';
  const paymentMethod =
    typeof body?.paymentMethod === 'string' ? PAYMENT_METHOD_MAP[body.paymentMethod] : undefined;

  if (items.length === 0) {
    return NextResponse.json({ error: 'No valid items to order.' }, { status: 400 });
  }

  if (!fullName || !contactNumber || !completeAddress || !paymentMethod) {
    return NextResponse.json({ error: 'Please fill in all delivery details.' }, { status: 400 });
  }

  // Notify the store owner's own WhatsApp for every well-formed order attempt —
  // independent of whether the items resolve to a real seller/DB order below,
  // so nothing placed by a customer goes unseen.
  await sendWhatsAppNotification(
    [
      '🍽️ New Food order request',
      `Customer: ${fullName}`,
      `Contact: ${contactNumber}`,
      `Address: ${completeAddress}`,
      `Payment: ${paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on Delivery' : 'EasyPaisa / JazzCash'}`,
      '',
      'Items:',
      ...items.map((item) => `- ${item.name ?? 'Item'} x${item.qty}${item.price ? ` (${item.price})` : ''}`),
    ].join('\n')
  );

  // Only approved GulPlaza owners/wholesalers are eligible — matches the same
  // gate the public /gulplaza catalog uses, so a stale cart can't check out
  // an item from a since-revoked seller.
  const products = await prisma.gulplazaProduct.findMany({
    where: {
      id: { in: items.map((item) => item.productId) },
      isActive: true,
      seller: { isApproved: true, sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] } },
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));

  const bySeller = new Map<string, { productId: string; quantity: number; price: number }[]>();

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) continue;

    const group = bySeller.get(product.sellerId) ?? [];
    group.push({ productId: product.id, quantity: item.qty, price: Number(product.price) });
    bySeller.set(product.sellerId, group);
  }

  if (bySeller.size === 0) {
    // Nothing here resolves to a currently-approved GulPlaza listing —
    // the owner was already notified above, so this is still a normal success for the customer.
    return NextResponse.json({ orders: [] }, { status: 201 });
  }

  let orders;

  try {
    orders = await prisma.$transaction(async (tx) => {
      const address = await tx.address.create({
        data: {
          userId: session.userId,
          label: `${fullName} • ${contactNumber}`,
          street: completeAddress,
          city: 'Karachi',
        },
      });

      const createdOrders = [];

      for (const [sellerId, groupItems] of bySeller) {
        // Atomically consume stock — the `stock: { gte }` guard prevents overselling
        // when two customers check out the same product at once.
        for (const item of groupItems) {
          const result = await tx.gulplazaProduct.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });

          if (result.count === 0) {
            const product = productById.get(item.productId);
            throw new InsufficientStockError(product?.name ?? 'this item', product?.stock ?? 0);
          }
        }

        const totalAmount = groupItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

        const order = await tx.gulplazaOrder.create({
          data: {
            customerId: customer.id,
            sellerId,
            addressId: address.id,
            totalAmount,
            items: {
              create: groupItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
              })),
            },
            payment: {
              create: {
                amount: totalAmount,
                method: paymentMethod,
              },
            },
          },
        });

        createdOrders.push(order);
      }

      return createdOrders;
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error:
            error.available > 0
              ? `Only ${error.available} of "${error.productName}" left in stock. Please update the quantity.`
              : `"${error.productName}" just sold out.`,
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json(
    { orders: orders.map((order) => ({ id: order.id, sellerId: order.sellerId })) },
    { status: 201 }
  );
}
