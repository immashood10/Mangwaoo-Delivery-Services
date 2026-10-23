import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  CART_AGE_FILTERS,
  formatWaiting,
  type AdminCartCustomer,
  type AdminCartItem,
  type AdminCartsData,
  type CartAge,
} from '@/lib/admin-cart-types';

// Admin > Still in Cart: every customer who has items in their cart and hasn't ordered them (the seller's
// "Pending — still in cart" page, but for all shops and restaurants at once). A cart row is deleted when the customer
// checks out or removes the item, so what is left is what is still waiting. The seller's own "remove from my list"
// (`dismissedAt`) is about their view only and does not hide anything here.

const MAX_CUSTOMERS_LISTED = 100;
/** Customers read to work out the totals and the chip counts; far more than anyone will scroll through. */
const MAX_CUSTOMERS_COUNTED = 1000;
const MAX_NAME_IN_REMINDER = 80;

// The same accounts the dashboard cards count: finished signups that were not deleted.
const LIVE_ACCOUNT = { phoneVerifiedAt: { not: null }, deletedAt: null } as const satisfies Prisma.UserWhereInput;

function reminderText(productNames: string[]) {
  const first = productNames[0].slice(0, MAX_NAME_IN_REMINDER);
  const others = productNames.length - 1;

  return others > 0
    ? `You still have ${first} and ${others} more ${others === 1 ? 'item' : 'items'} in your cart. Complete your order whenever you are ready.`
    : `You still have ${first} in your cart. Complete your order whenever you are ready.`;
}

export async function getAdminCarts(age: CartAge): Promise<AdminCartsData> {
  const now = Date.now();
  const minMs = CART_AGE_FILTERS.find((filter) => filter.value === age)?.minMs ?? 0;

  const [groups, valueRows] = await Promise.all([
    // One row per customer: their latest change and how much is in the cart, most recently active first.
    prisma.cartItem.groupBy({
      by: ['customerId'],
      where: { customer: { user: LIVE_ACCOUNT } },
      _max: { updatedAt: true },
      _sum: { quantity: true },
      orderBy: { _max: { updatedAt: 'desc' } },
      take: MAX_CUSTOMERS_COUNTED,
    }),
    prisma.$queryRaw<{ value: number }[]>`
      SELECT COALESCE(SUM(ci."price" * ci."quantity"), 0)::float8 AS "value"
      FROM "CartItem" ci
      JOIN "Customer" c ON c."id" = ci."customerId"
      JOIN "User" u ON u."id" = c."userId"
      WHERE u."deletedAt" IS NULL AND u."phoneVerifiedAt" IS NOT NULL`,
  ]);

  const waitingMsOf = (group: (typeof groups)[number]) => now - (group._max.updatedAt?.getTime() ?? now);

  const ageCounts = Object.fromEntries(
    CART_AGE_FILTERS.map((filter) => [filter.value, groups.filter((group) => waitingMsOf(group) >= filter.minMs).length])
  ) as Record<CartAge, number>;

  const matching = groups.filter((group) => waitingMsOf(group) >= minMs);
  const shown = matching.slice(0, MAX_CUSTOMERS_LISTED);
  const customerIds = shown.map((group) => group.customerId);

  const [customerRows, itemRows] =
    customerIds.length > 0
      ? await Promise.all([
          prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, user: { select: { id: true, name: true, email: true, phone: true } } },
          }),
          prisma.cartItem.findMany({
            where: { customerId: { in: customerIds } },
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              customerId: true,
              productName: true,
              quantity: true,
              price: true,
              marketplace: true,
              updatedAt: true,
              seller: { select: { businessName: true } },
            },
          }),
        ])
      : [[], []];

  const customersById = new Map(customerRows.map((customer) => [customer.id, customer]));
  const itemsByCustomer = new Map<string, AdminCartItem[]>();

  for (const row of itemRows) {
    const list = itemsByCustomer.get(row.customerId) ?? [];

    list.push({
      id: row.id,
      productName: row.productName,
      quantity: row.quantity,
      price: Number(row.price),
      store: row.seller.businessName,
      marketplace: row.marketplace,
      changed: formatWaiting(now - row.updatedAt.getTime()),
    });
    itemsByCustomer.set(row.customerId, list);
  }

  const customers = shown.flatMap((group): AdminCartCustomer[] => {
    const customer = customersById.get(group.customerId);
    const items = itemsByCustomer.get(group.customerId) ?? [];

    if (!customer || items.length === 0) return [];

    const waitingMs = waitingMsOf(group);

    return [
      {
        customerId: group.customerId,
        userId: customer.user.id,
        name: customer.user.name,
        email: customer.user.email,
        phone: customer.user.phone,
        waiting: formatWaiting(waitingMs),
        waitingMs,
        units: items.reduce((sum, item) => sum + item.quantity, 0),
        total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        items,
        reminder: reminderText(items.map((item) => item.productName)),
      },
    ];
  });

  return {
    customers,
    totals: {
      customers: groups.length,
      units: groups.reduce((sum, group) => sum + (group._sum.quantity ?? 0), 0),
      value: valueRows[0]?.value ?? 0,
    },
    ageCounts,
    hidden: Math.max(0, matching.length - shown.length),
  };
}
