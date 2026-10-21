import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { GULPLAZA_CATEGORIES, MART_CATEGORIES } from '@/lib/data';
import { getSellerUserIds, notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';

// The customer's cart lives in the database (CartItem), so it follows them to any browser or device.
// The browser asks for it after login (GET) and sends the whole cart back whenever it changes (PUT).

type Marketplace = 'MART' | 'GULPLAZA';

const MAX_CART_LINES = 100;
const MAX_LINE_QUANTITY = 99;

const MART_ICONS: Record<string, string> = Object.fromEntries(MART_CATEGORIES.map((category) => [category.name, category.icon]));
const FOOD_ICONS: Record<string, string> = Object.fromEntries(GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon]));

const lineKey = (marketplace: Marketplace, productId: string) => `${marketplace}:${productId}`;

type LiveProduct = {
  id: string;
  name: string;
  price: number;
  sellerId: string;
  vendor: string;
  icon: string;
};

/** Current details of the listed products behind the given cart lines (unlisted or deleted ones are simply absent). */
async function loadLiveProducts(lines: { marketplace: Marketplace; productId: string }[]) {
  const martIds = [...new Set(lines.filter((line) => line.marketplace === 'MART').map((line) => line.productId))];
  const foodIds = [...new Set(lines.filter((line) => line.marketplace === 'GULPLAZA').map((line) => line.productId))];

  const [martProducts, foodProducts] = await Promise.all([
    martIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: martIds }, isActive: true },
          select: { id: true, name: true, price: true, sellerId: true, seller: { select: { businessName: true } }, category: { select: { name: true } } },
        })
      : [],
    foodIds.length > 0
      ? prisma.gulplazaProduct.findMany({
          where: { id: { in: foodIds }, isActive: true },
          select: { id: true, name: true, price: true, sellerId: true, seller: { select: { businessName: true } }, category: { select: { name: true } } },
        })
      : [],
  ]);

  const live = new Map<string, LiveProduct>();

  for (const product of martProducts) {
    live.set(lineKey('MART', product.id), {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      sellerId: product.sellerId,
      vendor: product.seller.businessName,
      icon: MART_ICONS[product.category.name] ?? '🛍️',
    });
  }

  for (const product of foodProducts) {
    live.set(lineKey('GULPLAZA', product.id), {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      sellerId: product.sellerId,
      vendor: product.seller.businessName,
      icon: FOOD_ICONS[product.category.name] ?? '🍽️',
    });
  }

  return live;
}

async function getCustomer() {
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') return null;

  return prisma.customer.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true } } },
  });
}

/** The customer's saved cart, with each product's current name and price. Anyone else gets an empty cart. */
export async function GET() {
  const customer = await getCustomer();

  if (!customer) {
    return NextResponse.json({ items: [] });
  }

  const rows = await prisma.cartItem.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: 'asc' } });
  const live = await loadLiveProducts(rows.map((row) => ({ marketplace: row.marketplace, productId: row.productId })));

  const items = rows.flatMap((row) => {
    const product = live.get(lineKey(row.marketplace, row.productId));
    if (!product) return [];

    return [
      {
        id: product.id,
        name: product.name,
        price: `PKR ${product.price.toLocaleString()}`,
        icon: product.icon,
        vendor: product.vendor,
        sellerId: product.sellerId,
        marketplace: row.marketplace === 'GULPLAZA' ? ('gulplaza' as const) : ('mart' as const),
        qty: row.quantity,
      },
    ];
  });

  return NextResponse.json({ items });
}

type CartLine = { productId: string; marketplace: Marketplace; quantity: number };

/** Replaces the customer's saved cart with the one sent. */
export async function PUT(request: NextRequest) {
  const customer = await getCustomer();

  if (!customer) {
    return NextResponse.json({ error: 'Please log in as a customer to do this.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const rawLines: unknown[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_CART_LINES) : [];

  const lines: CartLine[] = rawLines
    .map((raw) => {
      const record = raw as Record<string, unknown>;
      const quantity = typeof record?.quantity === 'number' ? Math.floor(record.quantity) : 0;
      return {
        productId: typeof record?.productId === 'string' ? record.productId : '',
        marketplace: record?.marketplace === 'GULPLAZA' ? ('GULPLAZA' as const) : ('MART' as const),
        quantity: Math.min(quantity, MAX_LINE_QUANTITY),
      };
    })
    .filter((line) => line.productId && line.quantity > 0);

  // Names, prices and sellers come from the database, never from the browser.
  const live = await loadLiveProducts(lines);
  const wanted = new Map<string, { line: CartLine; product: LiveProduct }>();

  for (const line of lines) {
    const product = live.get(lineKey(line.marketplace, line.productId));
    if (product) wanted.set(lineKey(line.marketplace, line.productId), { line, product });
  }

  // Unchanged lines are left alone (a seller who removed one from their list keeps it removed) —
  // a line that is new, or whose quantity changed, shows up for the seller again.
  const existing = await prisma.cartItem.findMany({ where: { customerId: customer.id } });
  const existingByKey = new Map(existing.map((row) => [lineKey(row.marketplace, row.productId), row]));

  const removedIds = existing.filter((row) => !wanted.has(lineKey(row.marketplace, row.productId))).map((row) => row.id);
  const operations = [];
  const added: { productId: string; name: string; sellerId: string; quantity: number }[] = [];

  if (removedIds.length > 0) {
    operations.push(prisma.cartItem.deleteMany({ where: { id: { in: removedIds } } }));
  }

  for (const [key, { line, product }] of wanted) {
    const current = existingByKey.get(key);
    const unchanged =
      current &&
      current.quantity === line.quantity &&
      current.sellerId === product.sellerId &&
      current.productName === product.name &&
      Number(current.price) === product.price;

    if (unchanged) continue;

    const data = {
      sellerId: product.sellerId,
      productName: product.name,
      price: product.price,
      quantity: line.quantity,
      dismissedAt: null,
    };

    // upsert (not create) so two saves racing each other can't collide on the unique key
    operations.push(
      prisma.cartItem.upsert({
        where: {
          customerId_productId_marketplace: {
            customerId: customer.id,
            productId: line.productId,
            marketplace: line.marketplace,
          },
        },
        create: { customerId: customer.id, productId: line.productId, marketplace: line.marketplace, ...data },
        update: data,
      })
    );

    if (!current || line.quantity > current.quantity) {
      added.push({ productId: line.productId, name: product.name, sellerId: product.sellerId, quantity: line.quantity });
    }
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  // Tell each seller when something of theirs goes into (or up in) a cart.
  if (added.length > 0) {
    notifyAfterResponse(async () => {
      const sellerUserIds = await getSellerUserIds(added.map((item) => item.sellerId));

      return added.flatMap((item) => {
        const userId = sellerUserIds.get(item.sellerId);
        if (!userId) return [];

        return [
          {
            userId,
            type: 'CART' as const,
            title: 'Item added to a cart',
            message: `${customer.user.name} has ${item.name} (x${item.quantity}) in their cart.`,
            href: SELLER_PAGES.cart,
            refId: `cart:${customer.id}:${item.productId}`,
          },
        ];
      });
    });
  }

  return NextResponse.json({ success: true });
}
