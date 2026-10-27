import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { GULPLAZA_CATEGORIES, MART_CATEGORIES } from '@/lib/data';
import { cartRowProductId, readPortions, splitCartRowProductId, withPortionLabel, type Portion } from '@/lib/food-portions';
import { getSellerUserIds, notifyAfterResponse } from '@/lib/notify';
import { SELLER_PAGES } from '@/lib/notification-types';

// The customer's cart lives in the database (CartItem), so it follows them to any browser or device.
// The browser asks for it after login (GET) and sends the whole cart back whenever it changes (PUT).
//
// A dish sold by weight (250 g, 500 g, 1 kg ...) is a separate line per size: its row's productId is "<dish id>#<grams>"
// (lib/food-portions.ts), its productName carries the size ("Beef Yakhni Pulao (500 g)") and its price is that size's price,
// so the seller's and the admin's "still in cart" lists read right without knowing about sizes.

type Marketplace = 'MART' | 'GULPLAZA';

const MAX_CART_LINES = 100;
const MAX_LINE_QUANTITY = 99;

const MART_ICONS: Record<string, string> = Object.fromEntries(MART_CATEGORIES.map((category) => [category.name, category.icon]));
const FOOD_ICONS: Record<string, string> = Object.fromEntries(GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon]));

/** One cart line: the product, and for a dish sold by weight its size in grams (0 = none). */
const lineKey = (marketplace: Marketplace, productId: string, grams = 0) => `${marketplace}:${productId}:${grams}`;
const productKey = (marketplace: Marketplace, productId: string) => `${marketplace}:${productId}`;

type LiveProduct = {
  id: string;
  name: string;
  price: number;
  sellerId: string;
  vendor: string;
  icon: string;
  /** Food dishes sold by weight only. */
  portions: Portion[];
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
          select: { id: true, name: true, price: true, portions: true, sellerId: true, seller: { select: { businessName: true } }, category: { select: { name: true } } },
        })
      : [],
  ]);

  const live = new Map<string, LiveProduct>();

  for (const product of martProducts) {
    live.set(productKey('MART', product.id), {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      sellerId: product.sellerId,
      vendor: product.seller.businessName,
      icon: MART_ICONS[product.category.name] ?? '🛍️',
      portions: [],
    });
  }

  for (const product of foodProducts) {
    live.set(productKey('GULPLAZA', product.id), {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      sellerId: product.sellerId,
      vendor: product.seller.businessName,
      icon: FOOD_ICONS[product.category.name] ?? '🍽️',
      portions: readPortions(product.portions),
    });
  }

  return live;
}

/**
 * What a line of this product costs for the size asked: a dish sold by weight needs one of its sizes (its price is that
 * size's price), any other product has no size. null = the line no longer exists (the size was taken off, or sizes were
 * added to a dish that had one price), so it leaves the cart.
 */
function priceFor(product: LiveProduct, grams: number): { price: number; grams: number } | null {
  if (product.portions.length === 0) return grams === 0 ? { price: product.price, grams: 0 } : null;

  const portion = product.portions.find((candidate) => candidate.grams === grams);

  return portion ? { price: portion.price, grams: portion.grams } : null;
}

/** The product id and size a stored row stands for (only food rows can carry a size). */
function rowLine(row: { marketplace: Marketplace; productId: string }) {
  return row.marketplace === 'GULPLAZA' ? splitCartRowProductId(row.productId) : { productId: row.productId, grams: 0 };
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
  const live = await loadLiveProducts(rows.map((row) => ({ marketplace: row.marketplace, productId: rowLine(row).productId })));

  const items = rows.flatMap((row) => {
    const { productId, grams } = rowLine(row);
    const product = live.get(productKey(row.marketplace, productId));
    const priced = product ? priceFor(product, grams) : null;
    if (!product || !priced) return [];

    return [
      {
        id: product.id,
        name: product.name,
        price: `PKR ${priced.price.toLocaleString()}`,
        icon: product.icon,
        vendor: product.vendor,
        sellerId: product.sellerId,
        marketplace: row.marketplace === 'GULPLAZA' ? ('gulplaza' as const) : ('mart' as const),
        qty: row.quantity,
        ...(priced.grams > 0 ? { portion: priced.grams } : {}),
      },
    ];
  });

  return NextResponse.json({ items });
}

type CartLine = { productId: string; marketplace: Marketplace; quantity: number; portion: number };

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
      const marketplace = record?.marketplace === 'GULPLAZA' ? ('GULPLAZA' as const) : ('MART' as const);
      return {
        productId: typeof record?.productId === 'string' ? record.productId : '',
        marketplace,
        quantity: Math.min(quantity, MAX_LINE_QUANTITY),
        // Only a food dish can have a size; priceFor() checks it is one the dish really has.
        portion: marketplace === 'GULPLAZA' && typeof record?.portion === 'number' && Number.isInteger(record.portion) && record.portion > 0 ? record.portion : 0,
      };
    })
    .filter((line) => line.productId && line.quantity > 0);

  // Names, prices and sellers come from the database, never from the browser.
  const live = await loadLiveProducts(lines);
  const wanted = new Map<string, { line: CartLine; product: LiveProduct; price: number }>();

  for (const line of lines) {
    const product = live.get(productKey(line.marketplace, line.productId));
    const priced = product ? priceFor(product, line.portion) : null;
    if (product && priced) wanted.set(lineKey(line.marketplace, line.productId, priced.grams), { line, product, price: priced.price });
  }

  // Unchanged lines are left alone (a seller who removed one from their list keeps it removed) —
  // a line that is new, or whose quantity changed, shows up for the seller again.
  const existing = await prisma.cartItem.findMany({ where: { customerId: customer.id } });
  const keyOf = (row: (typeof existing)[number]) => {
    const { productId, grams } = rowLine(row);
    return lineKey(row.marketplace, productId, grams);
  };
  const existingByKey = new Map(existing.map((row) => [keyOf(row), row]));

  const removedIds = existing.filter((row) => !wanted.has(keyOf(row))).map((row) => row.id);
  const operations = [];
  const added: { rowProductId: string; name: string; sellerId: string; quantity: number }[] = [];

  if (removedIds.length > 0) {
    operations.push(prisma.cartItem.deleteMany({ where: { id: { in: removedIds } } }));
  }

  for (const [key, { line, product, price }] of wanted) {
    const current = existingByKey.get(key);
    const rowProductId = cartRowProductId(line.productId, line.portion);
    const productName = withPortionLabel(product.name, line.portion);
    const unchanged =
      current &&
      current.quantity === line.quantity &&
      current.sellerId === product.sellerId &&
      current.productName === productName &&
      Number(current.price) === price;

    if (unchanged) continue;

    const data = {
      sellerId: product.sellerId,
      productName,
      price,
      quantity: line.quantity,
      dismissedAt: null,
    };

    // upsert (not create) so two saves racing each other can't collide on the unique key
    operations.push(
      prisma.cartItem.upsert({
        where: {
          customerId_productId_marketplace: {
            customerId: customer.id,
            productId: rowProductId,
            marketplace: line.marketplace,
          },
        },
        create: { customerId: customer.id, productId: rowProductId, marketplace: line.marketplace, ...data },
        update: data,
      })
    );

    if (!current || line.quantity > current.quantity) {
      added.push({ rowProductId, name: productName, sellerId: product.sellerId, quantity: line.quantity });
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
            refId: `cart:${customer.id}:${item.rowProductId}`,
          },
        ];
      });
    });
  }

  return NextResponse.json({ success: true });
}
