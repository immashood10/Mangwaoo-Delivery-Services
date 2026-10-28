import type { Coupon, Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { billedDistanceKm, deliveryFeeForDistance, foodReach } from '@/lib/delivery';
import { type Coordinates } from '@/lib/geo';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { refreshFoodCatalog, refreshMartCatalog } from '@/lib/catalog-cache';
import { getSellerUserIds, notifyAdminsAfterResponse, notifyAfterResponse } from '@/lib/notify';
import { orderRef } from '@/lib/order-number';
import { ADMIN_PAGES, SELLER_PAGES } from '@/lib/notification-types';
import { normalizeCouponCode, type CouponScope } from '@/lib/coupons';
import { MART_PRODUCTS } from '@/lib/data';
import { readPortions } from '@/lib/food-portions';
import { consumeLoyaltyOffer, getLoyaltyOffer, type LoyaltyOffer } from '@/lib/loyalty-card';
import { allocateLoyaltyDiscount } from '@/lib/loyalty-card-config';
import type { CouponInfo, LoyaltyInfo, Marketplace, OrderQuote, Quote } from '@/lib/checkout-types';

export type { CouponInfo, LoyaltyInfo, Marketplace, OrderQuote, Quote };

// Prices a cart and turns it into orders. The browser only says WHAT is wanted (products, quantities, where to
// deliver, which coupon); every amount comes from here, from the database:
//   - items: the listed price of each product
//   - food delivery: distance charge of the ride from each restaurant to the customer (lib/delivery.ts); MangwaooMart has none
//   - coupon: a % off the items it applies to (never the delivery fee), paid by Mangwaoo, not the seller
//   - Loyalty Card: for a customer with an active card, the random % their card drew for this order, off what the items
//     still cost after the coupon (never the delivery fee), paid by Mangwaoo, not the seller (lib/loyalty-card.ts)

export type CheckoutLine = {
  productId: string;
  marketplace: Marketplace;
  qty: number;
  /** A food dish sold by weight: the size in grams. It must be one of the dish's own sizes; the price is that size's price. */
  portion?: number;
  /** What the browser showed; only used in the owner's WhatsApp notification. */
  name?: string;
  price?: string;
};

export class CheckoutError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

class InsufficientStockError extends Error {
  constructor(public productName: string, public available: number) {
    super(`Not enough stock for ${productName}`);
  }
}

/** `portion` is the size in grams of a dish sold by weight (0 = a dish with one price); `price` is already that size's price. */
type ResolvedLine = { productId: string; name: string; price: number; quantity: number; stock: number; portion: number };

type Group = {
  marketplace: Marketplace;
  sellerId: string;
  sellerName: string;
  location: Coordinates | null;
  lines: ResolvedLine[];
  subtotal: number;
};

const FOOD_SELLER_TYPES = ['GULPLAZA_OWNER', 'WHOLESALER'] as const;

// ── Coupons ─────────────────────────────────────────────────

const COUPON_INVALID = "That coupon code isn't valid.";

/** Checks the customer may use this coupon right now (the rules that can change between two checkouts). */
async function checkCouponAvailable(db: Prisma.TransactionClient, coupon: Coupon | null, customerId: string) {
  if (!coupon || !coupon.isActive) throw new CheckoutError(400, COUPON_INVALID);
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) throw new CheckoutError(400, 'This coupon has expired.');
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new CheckoutError(400, 'This coupon has been fully used.');
  }

  if (coupon.onePerCustomer) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, customerId, cancelledAt: null } });
    if (used > 0) throw new CheckoutError(400, "You've already used this coupon.");
  }
}

const SCOPE_OF: Record<Marketplace, Exclude<CouponScope, 'ALL'>> = { gulplaza: 'FOOD', mart: 'MART' };

/**
 * How much the coupon takes off each order: a % of the items it applies to, capped, in whole PKR, shared out between
 * those orders in proportion to their items.
 */
function allocateDiscount(coupon: Coupon, groups: Group[]) {
  const eligible = groups.filter((group) => coupon.appliesTo === 'ALL' || SCOPE_OF[group.marketplace] === coupon.appliesTo);

  if (eligible.length === 0) {
    throw new CheckoutError(
      400,
      coupon.appliesTo === 'FOOD' ? 'This coupon is only valid on food orders.' : 'This coupon is only valid on MangwaooMart orders.'
    );
  }

  const eligibleSubtotal = eligible.reduce((sum, group) => sum + group.subtotal, 0);
  const minimum = coupon.minOrderAmount === null ? 0 : Number(coupon.minOrderAmount);

  if (eligibleSubtotal < minimum) {
    const what = coupon.appliesTo === 'FOOD' ? 'food items' : coupon.appliesTo === 'MART' ? 'MangwaooMart items' : 'items';
    throw new CheckoutError(400, `Spend at least PKR ${minimum.toLocaleString('en-US')} on ${what} to use this coupon.`);
  }

  const cap = coupon.maxDiscountAmount === null ? Infinity : Number(coupon.maxDiscountAmount);
  const total = Math.floor(Math.min((eligibleSubtotal * coupon.discountPercent) / 100, cap));

  if (total < 1) throw new CheckoutError(400, "This coupon doesn't take anything off these items.");

  const shares = eligible.map((group) => Math.min(group.subtotal, Math.floor((total * group.subtotal) / eligibleSubtotal)));
  let left = total - shares.reduce((sum, share) => sum + share, 0);

  // The rupees lost to rounding go to the orders one at a time, never past what an order's items cost.
  for (let i = 0; left > 0 && i < eligible.length * 2; i++) {
    const index = i % eligible.length;
    if (shares[index] < Math.floor(eligible[index].subtotal)) {
      shares[index] += 1;
      left -= 1;
    }
  }

  return new Map(eligible.map((group, index) => [group, shares[index]]));
}

// ── Pricing ─────────────────────────────────────────────────

async function resolveGroups(lines: CheckoutLine[]) {
  const martIds = [...new Set(lines.filter((line) => line.marketplace === 'mart').map((line) => line.productId))];
  const foodIds = [...new Set(lines.filter((line) => line.marketplace === 'gulplaza').map((line) => line.productId))];

  const [martProducts, foodProducts] = await Promise.all([
    martIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: martIds }, isActive: true },
          select: { id: true, name: true, price: true, stock: true, sellerId: true, seller: { select: { businessName: true } } },
        })
      : [],
    // Only approved food businesses are eligible — the same gate the public Food catalog uses, so a stale cart
    // can't check out an item from a since-revoked seller.
    foodIds.length > 0
      ? prisma.gulplazaProduct.findMany({
          where: { id: { in: foodIds }, isActive: true, seller: { isApproved: true, sellerType: { in: [...FOOD_SELLER_TYPES] } } },
          select: {
            id: true,
            name: true,
            price: true,
            portions: true,
            stock: true,
            sellerId: true,
            seller: { select: { businessName: true, latitude: true, longitude: true } },
          },
        })
      : [],
  ]);

  const mart = new Map(martProducts.map((product) => [product.id, product]));
  const food = new Map(foodProducts.map((product) => [product.id, product]));
  const groups = new Map<string, Group>();
  // Dishes sold by weight whose chosen size is gone (the seller changed the sizes after it went into the cart): they are
  // left out of the price, and `placeOrders` refuses to go on, so nobody is charged for a size they didn't choose.
  const staleLines: string[] = [];

  for (const line of lines) {
    const product = line.marketplace === 'mart' ? mart.get(line.productId) : food.get(line.productId);
    if (!product) continue;

    let price = Number(product.price);
    let portion = 0;

    if ('portions' in product) {
      const portions = readPortions(product.portions);

      // A dish with sizes needs one of them; a dish without sizes can't be ordered "in a size".
      if (portions.length > 0 || line.portion) {
        const chosen = portions.find((candidate) => candidate.grams === line.portion);

        if (!chosen) {
          staleLines.push(product.name);
          continue;
        }

        price = chosen.price;
        portion = chosen.grams;
      }
    }

    const key = `${line.marketplace}:${product.sellerId}`;
    const seller = product.seller as { businessName: string; latitude?: number | null; longitude?: number | null };
    const group =
      groups.get(key) ??
      ({
        marketplace: line.marketplace,
        sellerId: product.sellerId,
        sellerName: seller.businessName,
        location:
          line.marketplace === 'gulplaza' && seller.latitude != null && seller.longitude != null
            ? { lat: seller.latitude, lng: seller.longitude }
            : null,
        lines: [],
        subtotal: 0,
      } satisfies Group);

    group.lines.push({ productId: product.id, name: product.name, price, quantity: line.qty, stock: product.stock, portion });
    // Rounded to paisa so sums like 0.1 + 0.2 don't leave floating point dust in the stored amounts.
    group.subtotal = Math.round((group.subtotal + price * line.qty) * 100) / 100;
    groups.set(key, group);
  }

  return { groups: [...groups.values()], staleLines };
}

const SAMPLE_PRODUCTS = new Map(MART_PRODUCTS.map((product) => [String(product.id), product]));

/**
 * The built-in sample items (`MART_PRODUCTS` in lib/data.ts) have no row in the database, so they are not placed as
 * orders (the owner is told by WhatsApp instead, see `placeOrders`). They are still priced, from that catalog and never
 * from what the browser sent, so the cart shows what they cost. One entry per vendor, no coupon and no delivery fee.
 */
function sampleOrders(lines: CheckoutLine[], groups: Group[]): OrderQuote[] {
  const inDatabase = new Set(groups.filter((group) => group.marketplace === 'mart').flatMap((group) => group.lines.map((line) => line.productId)));
  const subtotals = new Map<string, number>();

  for (const line of lines) {
    const sample = line.marketplace === 'mart' && !inDatabase.has(line.productId) ? SAMPLE_PRODUCTS.get(line.productId) : undefined;
    if (!sample) continue;

    const price = Number(sample.price.replace(/[^0-9.]/g, '')) || 0;
    subtotals.set(sample.vendor, Math.round(((subtotals.get(sample.vendor) ?? 0) + price * line.qty) * 100) / 100);
  }

  return [...subtotals].map(([vendor, subtotal]): OrderQuote => ({
    marketplace: 'mart',
    sellerId: `sample:${vendor}`,
    sellerName: vendor,
    subtotal,
    deliveryFee: 0,
    distanceKm: null,
    deliveryNote: null,
    farAway: false,
    couponDiscount: 0,
    loyaltyDiscount: 0,
    discount: 0,
    total: subtotal,
  }));
}

/**
 * `staleLines` are the names of dishes sold by weight whose chosen size is no longer on offer (they are not in `groups`).
 * `loyalty` is the customer's Loyalty Card offer when it is taking something off this cart (placeOrders uses it up).
 */
type Priced = { groups: Group[]; quote: Quote; coupon: Coupon | null; loyalty: LoyaltyOffer | null; staleLines: string[] };

/** Prices the cart. Throws a CheckoutError for a coupon that can't be used. */
export async function priceCheckout(input: {
  lines: CheckoutLine[];
  dropoff: Coordinates | null;
  couponCode: string | null;
  customerId: string;
}): Promise<Priced> {
  const { groups, staleLines } = await resolveGroups(input.lines);
  const samples = sampleOrders(input.lines, groups);

  let coupon: Coupon | null = null;
  let shares = new Map<Group, number>();

  if (input.couponCode) {
    const code = normalizeCouponCode(input.couponCode);
    coupon = code ? await prisma.coupon.findUnique({ where: { code } }) : null;

    await checkCouponAvailable(prisma, coupon, input.customerId);
    if (groups.length === 0) {
      throw new CheckoutError(400, samples.length > 0 ? "Coupons can't be used on sample items." : 'Add something to your cart to use a coupon.');
    }

    shares = allocateDiscount(coupon as Coupon, groups);
  }

  // The customer's Loyalty Card: the random % it drew for this order, off what each order's items still cost after the coupon.
  let loyalty: LoyaltyOffer | null = null;
  let loyaltyShares: number[] = [];

  if (groups.length > 0) {
    loyalty = await getLoyaltyOffer(input.customerId);

    if (loyalty) {
      loyaltyShares = allocateLoyaltyDiscount(loyalty.percent, loyalty.maxDiscount, groups.map((group) => group.subtotal - (shares.get(group) ?? 0)));

      // Under Rs 1 in all (a tiny cart): nothing is taken off, so the card's draw is not used up.
      if (loyaltyShares.every((share) => share === 0)) {
        loyalty = null;
        loyaltyShares = [];
      }
    }
  }

  // The sample items come last, so `orders[i]` stays the order of `groups[i]` (placeOrders relies on that).
  const orders: OrderQuote[] = groups.map((group, index) => {
    const isFood = group.marketplace === 'gulplaza';
    const couponDiscount = shares.get(group) ?? 0;
    const loyaltyDiscount = loyaltyShares[index] ?? 0;
    const discount = couponDiscount + loyaltyDiscount;
    let deliveryFee = 0;
    let distanceKm: number | null = null;
    let deliveryNote: OrderQuote['deliveryNote'] = null;
    let farAway = false;

    if (isFood) {
      // The fee follows the distance, however far: a restaurant beyond FOOD_DELIVERY_RADIUS_KM is only flagged `farAway`
      // (the cart tells the customer it costs more). Without both pins there is no distance, so no fee (placeOrders refuses).
      const reach = foodReach(input.dropoff, group.location);

      if (reach.status === 'NEEDS_ORIGIN') deliveryNote = 'NEEDS_DROPOFF';
      else if (reach.status === 'NO_PIN') deliveryNote = 'NO_RESTAURANT_PIN';
      else {
        distanceKm = billedDistanceKm(reach.distanceKm);
        deliveryFee = deliveryFeeForDistance(distanceKm);
        farAway = reach.status === 'FAR';
      }
    }

    return {
      marketplace: group.marketplace,
      sellerId: group.sellerId,
      sellerName: group.sellerName,
      subtotal: group.subtotal,
      deliveryFee,
      distanceKm,
      deliveryNote,
      farAway,
      couponDiscount,
      loyaltyDiscount,
      discount,
      total: group.subtotal - discount + deliveryFee,
    };
  }).concat(samples);

  const sum = (pick: (order: OrderQuote) => number) => orders.reduce((total, order) => total + pick(order), 0);

  return {
    groups,
    coupon,
    loyalty,
    staleLines,
    quote: {
      orders,
      subtotal: sum((order) => order.subtotal),
      delivery: sum((order) => order.deliveryFee),
      discount: sum((order) => order.discount),
      couponDiscount: sum((order) => order.couponDiscount),
      total: sum((order) => order.total),
      coupon: coupon
        ? {
            code: coupon.code,
            percent: coupon.discountPercent,
            description: coupon.description,
            maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
          }
        : null,
      loyalty: loyalty ? { percent: loyalty.percent, discount: sum((order) => order.loyaltyDiscount) } : null,
    },
  };
}

// ── Placing orders ──────────────────────────────────────────

export type PlaceOrdersInput = {
  customer: { id: string; userId: string };
  lines: CheckoutLine[];
  fullName: string;
  contactNumber: string;
  completeAddress: string;
  note: string;
  paymentMethod: 'CASH_ON_DELIVERY' | 'WALLET';
  dropoff: Coordinates | null;
  couponCode: string | null;
};

/** `ref` is the order number both the customer and the seller see, e.g. MW-F10001. */
export type PlacedOrder = { id: string; ref: string; sellerId: string; marketplace: Marketplace };

export type PlaceOrdersResult = { orders: PlacedOrder[]; quote: Quote };

const TRANSACTION_OPTIONS = { timeout: 30000, maxWait: 10000 };

/**
 * Food can be ordered from a restaurant at any distance, but the delivery fee follows the distance, so both ends must be
 * on the map: the cart page shows the same thing and blocks the button, but this is the real gate (a stale cart, an old
 * tab or a hand-made request can't get past it). A restaurant that hasn't pinned its kitchen, or an order with no
 * drop-off, has no distance and so no fee: it is refused.
 */
function assertFoodDeliverable(orders: OrderQuote[]) {
  for (const order of orders) {
    if (order.marketplace !== 'gulplaza') continue;

    if (order.deliveryNote === 'NO_RESTAURANT_PIN') {
      throw new CheckoutError(
        400,
        `${order.sellerName} hasn't set its location on the map yet, so we can't work out the delivery fee. Please choose another restaurant.`
      );
    }

    if (order.deliveryNote === 'NEEDS_DROPOFF') {
      throw new CheckoutError(400, 'Please pin your delivery location, so we can work out the delivery fee.');
    }
  }
}

function ownerNotification(marketplace: Marketplace, input: PlaceOrdersInput, lines: CheckoutLine[], orders: OrderQuote[], loyaltyPercent: number | null) {
  const delivery = orders.reduce((sum, order) => sum + order.deliveryFee, 0);
  const couponDiscount = orders.reduce((sum, order) => sum + order.couponDiscount, 0);
  const loyaltyDiscount = orders.reduce((sum, order) => sum + order.loyaltyDiscount, 0);

  return [
    marketplace === 'mart' ? '🛒 New order request' : '🍽️ New Food order request',
    `Customer: ${input.fullName}`,
    `Contact: ${input.contactNumber}`,
    `Address: ${input.completeAddress}`,
    `Payment: ${input.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on Delivery' : 'EasyPaisa / JazzCash'}`,
    ...(input.note ? [`Note: ${input.note}`] : []),
    ...(marketplace === 'gulplaza' && delivery > 0 ? [`Delivery fee: PKR ${delivery.toLocaleString()}`] : []),
    ...(couponDiscount > 0 && input.couponCode ? [`Coupon: ${input.couponCode.toUpperCase()} (−PKR ${couponDiscount.toLocaleString()})`] : []),
    ...(loyaltyDiscount > 0 && loyaltyPercent ? [`Loyalty Card: ${loyaltyPercent}% (−PKR ${loyaltyDiscount.toLocaleString()})`] : []),
    '',
    'Items:',
    ...lines.map((line) => `- ${line.name ?? 'Item'} x${line.qty}${line.price ? ` (${line.price})` : ''}`),
  ].join('\n');
}

/**
 * Places the orders for a cart: one order per seller, all in one transaction so stock, the coupon and the orders
 * stand or fall together. Throws CheckoutError (the customer can fix it) or lets other errors through.
 */
export async function placeOrders(input: PlaceOrdersInput): Promise<PlaceOrdersResult> {
  // A coupon that can't be used stops the checkout here, before anyone is told about an order.
  const { groups, quote, coupon, loyalty, staleLines } = await priceCheckout({
    lines: input.lines,
    dropoff: input.dropoff,
    couponCode: input.couponCode,
    customerId: input.customer.id,
  });

  // A size that was taken off after the dish went into the cart: the customer chooses again before anything is placed.
  if (staleLines.length > 0) {
    const names = [...new Set(staleLines)].map((name) => `"${name}"`).join(', ');
    throw new CheckoutError(409, `The size you chose for ${names} is no longer available. Please remove it from your cart and choose a size again.`);
  }

  // Nothing is placed (or announced to the owner) for a food order that has no delivery fee (a missing pin).
  assertFoodDeliverable(quote.orders);

  // Tell the owner's own WhatsApp about every well-formed order attempt — independent of whether the items resolve
  // to a real seller/DB order below, so nothing placed by a customer goes unseen.
  const marketplaces = (['mart', 'gulplaza'] as const).filter((marketplace) => input.lines.some((line) => line.marketplace === marketplace));
  await Promise.all(
    marketplaces.map((marketplace) =>
      sendWhatsAppNotification(
        ownerNotification(
          marketplace,
          input,
          input.lines.filter((line) => line.marketplace === marketplace),
          quote.orders.filter((order) => order.marketplace === marketplace),
          quote.loyalty?.percent ?? null
        )
      )
    )
  );

  // Nothing here resolves to a real seller-backed product (e.g. demo catalog items, which `priceCheckout` still
  // prices): the owner was already notified above, so this is still a normal success for the customer.
  if (groups.length === 0) return { orders: [], quote };

  let placed: PlacedOrder[];

  try {
    placed = await prisma.$transaction(async (tx) => {
      let redemptionId: string | null = null;

      if (coupon) {
        // One checkout at a time per coupon, so "used once" and the usage limit hold even if the customer
        // double-clicks or two customers take the last use together.
        await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${coupon.id} FOR UPDATE`;
        await checkCouponAvailable(tx, await tx.coupon.findUnique({ where: { id: coupon.id } }), input.customer.id);

        const redemption = await tx.couponRedemption.create({ data: { couponId: coupon.id, customerId: input.customer.id } });
        await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        redemptionId = redemption.id;
      }

      // The Loyalty Card discount the cart was priced with is used up here (one checkout at a time per card). If the card
      // changed since the cart was priced, nothing is placed: the customer looks at the cart again instead of paying a
      // different amount than they were shown.
      let loyaltyRedemptionId: string | null = null;

      if (loyalty && quote.loyalty) {
        loyaltyRedemptionId = await consumeLoyaltyOffer(tx, input.customer.id, loyalty, quote.loyalty.discount);

        if (!loyaltyRedemptionId) {
          throw new CheckoutError(409, 'Your Loyalty Card discount just changed. Please look at your cart and place the order again.');
        }
      }

      const address = await tx.address.create({
        data: {
          userId: input.customer.userId,
          label: `${input.fullName} • ${input.contactNumber}`,
          street: input.completeAddress,
          city: 'Karachi',
        },
      });

      const created: PlacedOrder[] = [];

      for (const [index, group] of groups.entries()) {
        const orderQuote = quote.orders[index];

        // Atomically consume stock — the `stock: { gte }` guard prevents overselling when two customers check
        // out the same product at once.
        for (const line of group.lines) {
          const result =
            group.marketplace === 'mart'
              ? await tx.product.updateMany({
                  where: { id: line.productId, stock: { gte: line.quantity } },
                  data: { stock: { decrement: line.quantity } },
                })
              : await tx.gulplazaProduct.updateMany({
                  where: { id: line.productId, stock: { gte: line.quantity } },
                  data: { stock: { decrement: line.quantity } },
                });

          if (result.count === 0) throw new InsufficientStockError(line.name, line.stock);
        }

        const common = {
          customerId: input.customer.id,
          sellerId: group.sellerId,
          addressId: address.id,
          totalAmount: group.subtotal,
          discountAmount: orderQuote.discount,
          note: input.note || null,
          ...(coupon && orderQuote.couponDiscount > 0 ? { couponId: coupon.id, redemptionId } : {}),
          ...(loyalty && loyaltyRedemptionId && orderQuote.loyaltyDiscount > 0
            ? { loyaltyDiscount: orderQuote.loyaltyDiscount, loyaltyPercent: loyalty.percent, loyaltyRedemptionId }
            : {}),
        };
        const itemRows = group.lines.map((line) => ({ productId: line.productId, quantity: line.quantity, price: line.price }));
        // A dish sold by weight remembers the size that was ordered (its price is that size's price).
        const foodItemRows = group.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          price: line.price,
          portionGrams: line.portion > 0 ? line.portion : null,
        }));
        const payment = { create: { amount: orderQuote.total, method: input.paymentMethod } };

        const order =
          group.marketplace === 'mart'
            ? await tx.order.create({ data: { ...common, items: { create: itemRows }, payment } })
            : await tx.gulplazaOrder.create({
                data: { ...common, deliveryFee: orderQuote.deliveryFee, items: { create: foodItemRows }, payment },
              });

        created.push({ id: order.id, ref: orderRef(group.marketplace, order.orderNumber), sellerId: group.sellerId, marketplace: group.marketplace });
      }

      return created;
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      throw new CheckoutError(
        409,
        error.available > 0
          ? `Only ${error.available} of "${error.productName}" left in stock. Please update the quantity.`
          : `"${error.productName}" just sold out.`
      );
    }

    throw error;
  }

  // Stock just dropped — keep menus, catalog pages and the sold-out state accurate.
  if (placed.some((order) => order.marketplace === 'mart')) refreshMartCatalog();
  if (placed.some((order) => order.marketplace === 'gulplaza')) refreshFoodCatalog();

  // Tell each seller they have a new order to handle.
  notifyAfterResponse(async () => {
    const sellerUserIds = await getSellerUserIds(placed.map((order) => order.sellerId));

    return placed.flatMap((order, index) => {
      const userId = sellerUserIds.get(order.sellerId);
      if (!userId) return [];

      return [
        {
          userId,
          type: 'ORDER' as const,
          title: 'New order',
          message: `Order ${order.ref} from ${input.fullName} - PKR ${quote.orders[index].subtotal.toLocaleString()}.`,
          href: SELLER_PAGES.orders,
          refId: `order:${order.id}`,
        },
      ];
    });
  });

  // The customer gets the order number(s) at once, to quote to the seller or the rider.
  notifyAfterResponse(async () => ({
    userId: input.customer.userId,
    type: 'ORDER' as const,
    title: placed.length > 1 ? 'Orders placed' : 'Order placed',
    message: `Your order number${placed.length > 1 ? 's are' : ' is'} ${placed.map((order) => order.ref).join(', ')}. You can follow it in My Account.`,
    href: '/account',
    refId: `placed:${placed[0].id}`,
  }));

  // Tell the admins too: one line per checkout, however many seller orders it made.
  notifyAdminsAfterResponse(async () => {
    // Only the orders that were really placed (sample items come after them in the quote).
    const payable = quote.orders.slice(0, placed.length).reduce((sum, order) => sum + order.subtotal, 0);

    return {
      type: 'ORDER' as const,
      title: placed.length > 1 ? `${placed.length} new orders` : 'New order',
      message: `${input.fullName} placed ${placed.length > 1 ? `${placed.length} orders` : `order ${placed[0].ref}`} - PKR ${payable.toLocaleString()} in items.`,
      href: ADMIN_PAGES.orders,
      refId: `order:${placed[0].id}`,
    };
  });

  return { orders: placed, quote };
}
