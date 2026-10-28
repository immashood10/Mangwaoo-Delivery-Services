import { randomInt } from 'node:crypto';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_CARD_SETTINGS,
  cardRef,
  type LoyaltyCardSettingsValues,
  type LoyaltyCardStatusKey,
} from '@/lib/loyalty-card-config';

// The Mangwaoo Loyalty Card (the rules are in lib/loyalty-card-config.ts). A customer with enough delivered orders gets a
// LoyaltyCard row (ELIGIBLE, once: the customer is unique) and a notification; they apply (PENDING); an admin approves
// (APPROVED) or turns them down (REJECTED, they may apply again) and can take an approved card back (REVOKED).
// An approved card always holds the discount % its owner's NEXT order will get (`nextPercent`): checkout shows it in the cart,
// takes it off the items when the order is placed and draws a fresh one for the order after. When every order of a checkout
// that used it is cancelled, the percent goes back on the card (like a coupon use).

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

const TRANSACTION_OPTIONS = { timeout: 20000, maxWait: 10000 } as const;

/** A whole number from `min` to `max`, both included, from the system's secure random source. */
function drawPercent(min: number, max: number) {
  return randomInt(min, max + 1);
}

export async function getCardSettings(client: Db = prisma): Promise<LoyaltyCardSettingsValues> {
  const row = await client.loyaltyCardSettings.findUnique({ where: { id: 'default' } });

  if (!row) return DEFAULT_CARD_SETTINGS;

  return {
    enabled: row.enabled,
    ordersRequired: row.ordersRequired,
    percentMin: row.percentMin,
    percentMax: row.percentMax,
    maxDiscount: row.maxDiscount,
  };
}

export async function saveCardSettings(settings: LoyaltyCardSettingsValues) {
  await prisma.loyaltyCardSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...settings }, update: settings });
}

/** Orders of this customer that have been delivered, MangwaooMart and food together. One query at a time (a transaction has one connection). */
export async function countDeliveredOrders(customerId: string, client: Db = prisma) {
  const mart = await client.order.count({ where: { customerId, status: 'DELIVERED' } });
  const food = await client.gulplazaOrder.count({ where: { customerId, status: 'DELIVERED' } });

  return mart + food;
}

// ── Becoming eligible, applying ─────────────────────────────

export type InviteResult = { invited: true; customerUserId: string; ordersRequired: number } | { invited: false };

/**
 * Makes the customer's card row (ELIGIBLE) the first time their delivered orders reach the number needed, and says so (the
 * caller sends the notification). Safe to call as often as you like: there is one row per customer, so only the call that
 * creates it answers `invited: true`.
 */
export async function ensureLoyaltyInvitation(customerId: string): Promise<InviteResult> {
  const settings = await getCardSettings();

  if (!settings.enabled) return { invited: false };

  const existing = await prisma.loyaltyCard.findUnique({ where: { customerId }, select: { id: true } });

  if (existing) return { invited: false };

  const delivered = await countDeliveredOrders(customerId);

  if (delivered < settings.ordersRequired) return { invited: false };

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { userId: true, user: { select: { deletedAt: true } } } });

  if (!customer || customer.user.deletedAt) return { invited: false };

  try {
    await prisma.loyaltyCard.create({ data: { customerId } });
  } catch (error) {
    // Two deliveries at the very same moment: the other one made the row.
    if ((error as { code?: string })?.code === 'P2002') return { invited: false };

    throw error;
  }

  return { invited: true, customerUserId: customer.userId, ordersRequired: settings.ordersRequired };
}

export type ApplyResult =
  | { ok: true; cardId: string; ref: string; customerName: string; delivered: number }
  | { ok: false; status: number; error: string };

/** The customer asks for the card. Needs enough delivered orders; an admin decides. Exactly one of two presses at once wins. */
export async function applyForLoyaltyCard(customerId: string): Promise<ApplyResult> {
  const settings = await getCardSettings();

  if (!settings.enabled) return { ok: false, status: 403, error: 'Loyalty Card applications are paused for now.' };

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { user: { select: { name: true, deletedAt: true } } } });

  if (!customer || customer.user.deletedAt) return { ok: false, status: 404, error: 'Customer account not found.' };

  const delivered = await countDeliveredOrders(customerId);

  if (delivered < settings.ordersRequired) {
    const more = settings.ordersRequired - delivered;

    return { ok: false, status: 409, error: `You need ${more} more delivered ${more === 1 ? 'order' : 'orders'} before you can apply.` };
  }

  const now = new Date();
  const result = (card: { id: string; cardNumber: number }): ApplyResult => ({
    ok: true,
    cardId: card.id,
    ref: cardRef(card.cardNumber),
    customerName: customer.user.name,
    delivered,
  });

  // The invitation row is made when the order is delivered; if that never happened, the application makes the row itself.
  try {
    return result(await prisma.loyaltyCard.create({ data: { customerId, status: 'PENDING', appliedAt: now }, select: { id: true, cardNumber: true } }));
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
  }

  const claimed = await prisma.loyaltyCard.updateMany({
    where: { customerId, status: { in: ['ELIGIBLE', 'REJECTED'] } },
    data: { status: 'PENDING', appliedAt: now, note: null, reviewedAt: null, reviewedById: null },
  });

  const card = await prisma.loyaltyCard.findUnique({ where: { customerId }, select: { id: true, cardNumber: true, status: true } });

  if (!card) return { ok: false, status: 404, error: 'Loyalty Card not found.' };
  if (claimed.count > 0) return result(card);

  if (card.status === 'PENDING') return { ok: false, status: 409, error: 'Your application is already waiting for approval.' };
  if (card.status === 'APPROVED') return { ok: false, status: 409, error: 'You already have a Loyalty Card.' };

  return { ok: false, status: 403, error: 'Your Loyalty Card was taken back. Please contact Mangwaoo Support.' };
}

// ── The admin's decisions ───────────────────────────────────

export type ReviewResult =
  | { ok: true; customerUserId: string; customerName: string; ref: string }
  | { ok: false; status: number; error: string };

async function cardOwner(cardId: string) {
  return prisma.loyaltyCard.findUnique({
    where: { id: cardId },
    select: { cardNumber: true, customer: { select: { userId: true, user: { select: { name: true, deletedAt: true } } } } },
  });
}

/** Approves a waiting application (or gives a taken-back card back): the card is active and its first discount is drawn. */
export async function approveLoyaltyCard(cardId: string, adminId: string): Promise<ReviewResult> {
  const settings = await getCardSettings();
  const owner = await cardOwner(cardId);

  if (!owner) return { ok: false, status: 404, error: 'Loyalty Card not found.' };
  if (owner.customer.user.deletedAt) return { ok: false, status: 409, error: 'This customer account was removed.' };

  const now = new Date();
  // The status guard lets exactly one admin click (or one of approve / turn down) win.
  const claimed = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, status: { in: ['PENDING', 'REVOKED'] } },
    data: {
      status: 'APPROVED',
      approvedAt: now,
      reviewedAt: now,
      reviewedById: adminId,
      note: null,
      nextPercent: drawPercent(settings.percentMin, settings.percentMax),
    },
  });

  if (claimed.count === 0) return { ok: false, status: 409, error: 'This card was already dealt with.' };

  return { ok: true, customerUserId: owner.customer.userId, customerName: owner.customer.user.name, ref: cardRef(owner.cardNumber) };
}

/** Turns a waiting application down; the customer may apply again later. */
export async function rejectLoyaltyCard(cardId: string, adminId: string, reason: string): Promise<ReviewResult> {
  const owner = await cardOwner(cardId);

  if (!owner) return { ok: false, status: 404, error: 'Loyalty Card not found.' };

  const claimed = await prisma.loyaltyCard.updateMany({
    where: { id: cardId, status: 'PENDING' },
    data: { status: 'REJECTED', note: reason || null, reviewedAt: new Date(), reviewedById: adminId },
  });

  if (claimed.count === 0) return { ok: false, status: 409, error: 'This application was already dealt with.' };

  return { ok: true, customerUserId: owner.customer.userId, customerName: owner.customer.user.name, ref: cardRef(owner.cardNumber) };
}

/** Takes an active card back: from the next order on there is no discount. A checkout that is being placed right now finishes first. */
export async function revokeLoyaltyCard(cardId: string, adminId: string, reason: string): Promise<ReviewResult> {
  const owner = await cardOwner(cardId);

  if (!owner) return { ok: false, status: 404, error: 'Loyalty Card not found.' };

  const changed = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "LoyaltyCard" WHERE "id" = ${cardId} FOR UPDATE`;

    const claimed = await tx.loyaltyCard.updateMany({
      where: { id: cardId, status: 'APPROVED' },
      data: { status: 'REVOKED', nextPercent: null, note: reason || null, reviewedAt: new Date(), reviewedById: adminId },
    });

    return claimed.count > 0;
  }, TRANSACTION_OPTIONS);

  if (!changed) return { ok: false, status: 409, error: 'This card is not active, so there is nothing to take back.' };

  return { ok: true, customerUserId: owner.customer.userId, customerName: owner.customer.user.name, ref: cardRef(owner.cardNumber) };
}

/** What happens to a card when its owner's account is deleted: it can never be used or applied for again. Call inside that transaction. */
export async function closeCustomerLoyaltyCard(tx: Tx, customerId: string) {
  await tx.loyaltyCard.updateMany({
    where: { customerId, status: { in: ['ELIGIBLE', 'PENDING', 'APPROVED'] } },
    data: { status: 'REVOKED', nextPercent: null, note: 'The account was removed.', reviewedAt: new Date() },
  });
}

// ── The discount at checkout (lib/checkout.ts) ──────────────

export type LoyaltyOffer = {
  cardId: string;
  /** The discount % the customer's next order gets. */
  percent: number;
  /** The most one checkout can be reduced by (PKR), 0 = no limit. */
  maxDiscount: number;
};

/** The discount a customer's next order would get, or null when they have no active card (or the scheme is off). */
export async function getLoyaltyOffer(customerId: string, client: Db = prisma): Promise<LoyaltyOffer | null> {
  const settings = await getCardSettings(client);

  if (!settings.enabled) return null;

  const card = await client.loyaltyCard.findUnique({ where: { customerId }, select: { id: true, status: true, nextPercent: true } });

  if (!card || card.status !== 'APPROVED' || card.nextPercent === null) return null;

  return { cardId: card.id, percent: card.nextPercent, maxDiscount: settings.maxDiscount };
}

/**
 * Uses up the discount an order was priced with: inside the checkout's transaction, one checkout at a time per card, it
 * records the use (`amount` is what it took off in PKR) and draws the percent for the customer's next order. Returns the
 * use's id, or null when the card changed since the cart was priced (taken back, paused, or used by another checkout in the
 * meantime): the caller then stops, so nobody pays a different amount than they were shown.
 */
export async function consumeLoyaltyOffer(tx: Tx, customerId: string, offer: LoyaltyOffer, amount: number): Promise<string | null> {
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyCard" WHERE "id" = ${offer.cardId} FOR UPDATE`;

  // One query at a time: a transaction has a single connection.
  const settings = await getCardSettings(tx);
  const card = await tx.loyaltyCard.findUnique({ where: { id: offer.cardId }, select: { customerId: true, status: true, nextPercent: true } });

  if (!settings.enabled || !card || card.customerId !== customerId || card.status !== 'APPROVED' || card.nextPercent !== offer.percent) return null;

  const redemption = await tx.loyaltyRedemption.create({ data: { cardId: offer.cardId, customerId, percent: offer.percent, amount } });

  await tx.loyaltyCard.update({ where: { id: offer.cardId }, data: { nextPercent: drawPercent(settings.percentMin, settings.percentMax) } });

  return redemption.id;
}

/**
 * A checkout that used the card gives its percent back once every order it created has been cancelled (by the customer, the
 * seller or an account removal): the card's next order gets that percent again. Call it inside the transaction that cancels an order.
 */
export async function releaseLoyaltyIfUnused(tx: Tx, redemptionId: string | null) {
  if (!redemptionId) return;

  // Two orders of one checkout cancelled at the same moment: whoever comes second waits here and then sees both cancelled.
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyRedemption" WHERE "id" = ${redemptionId} FOR UPDATE`;

  const martLeft = await tx.order.count({ where: { loyaltyRedemptionId: redemptionId, status: { not: 'CANCELLED' } } });
  const foodLeft = await tx.gulplazaOrder.count({ where: { loyaltyRedemptionId: redemptionId, status: { not: 'CANCELLED' } } });

  if (martLeft + foodLeft > 0) return;

  // The null guard makes this happen once.
  const released = await tx.loyaltyRedemption.updateMany({ where: { id: redemptionId, releasedAt: null }, data: { releasedAt: new Date() } });

  if (released.count === 0) return;

  const redemption = await tx.loyaltyRedemption.findUnique({ where: { id: redemptionId }, select: { cardId: true, percent: true } });

  if (redemption) {
    // Only a card that is still active takes the percent back.
    await tx.loyaltyCard.updateMany({ where: { id: redemption.cardId, status: 'APPROVED' }, data: { nextPercent: redemption.percent } });
  }
}

// ── What the pages show ─────────────────────────────────────

export type LoyaltyCardPageData = {
  enabled: boolean;
  ordersRequired: number;
  /** Orders delivered so far. */
  delivered: number;
  holderName: string;
  card: { ref: string; status: LoyaltyCardStatusKey; appliedAt: string | null; approvedAt: string | null; note: string | null } | null;
  canApply: boolean;
  /** What the card has taken off so far: checkouts that used it (not given back) and the rupees. */
  usage: { checkouts: number; saved: number };
};

/** Everything on a customer's Loyalty Card page. */
export async function getLoyaltyCardPage(customerId: string): Promise<LoyaltyCardPageData> {
  const settings = await getCardSettings();
  const [customer, card] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { user: { select: { name: true } } } }),
    prisma.loyaltyCard.findUnique({ where: { customerId } }),
  ]);
  const delivered = await countDeliveredOrders(customerId);
  const used = card ? await prisma.loyaltyRedemption.aggregate({ where: { cardId: card.id, releasedAt: null }, _sum: { amount: true }, _count: { _all: true } }) : null;

  const canApply =
    settings.enabled && delivered >= settings.ordersRequired && (!card || card.status === 'ELIGIBLE' || card.status === 'REJECTED');

  return {
    enabled: settings.enabled,
    ordersRequired: settings.ordersRequired,
    delivered,
    holderName: customer.user.name,
    card: card
      ? {
          ref: cardRef(card.cardNumber),
          status: card.status,
          appliedAt: card.appliedAt?.toISOString() ?? null,
          approvedAt: card.approvedAt?.toISOString() ?? null,
          note: card.note,
        }
      : null,
    canApply,
    usage: { checkouts: used?._count._all ?? 0, saved: used?._sum.amount ?? 0 },
  };
}

export type LoyaltyCardSummary = { status: LoyaltyCardStatusKey | null; canApply: boolean };

/** Just enough for the link on My Account: the card's state, and whether the customer can apply now. */
export async function getLoyaltyCardSummary(customerId: string): Promise<LoyaltyCardSummary> {
  const settings = await getCardSettings();
  const card = await prisma.loyaltyCard.findUnique({ where: { customerId }, select: { status: true } });
  const status = card?.status ?? null;

  if (!settings.enabled || (status !== null && status !== 'ELIGIBLE' && status !== 'REJECTED')) return { status, canApply: false };

  return { status, canApply: (await countDeliveredOrders(customerId)) >= settings.ordersRequired };
}

export type PendingApplication = {
  id: string;
  ref: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string;
  accountRemoved: boolean;
  appliedAt: string;
  /** Delivered orders and what their items came to (PKR), to help the admin decide. */
  delivered: number;
  itemsValue: number;
  /** The reason of an earlier turn-down, when this is a second application. */
  earlierNote: string | null;
};

export type CardHolder = {
  id: string;
  ref: string;
  customerName: string;
  accountRemoved: boolean;
  approvedAt: string | null;
  checkouts: number;
  saved: number;
};

export type CardDecision = {
  id: string;
  ref: string;
  customerName: string;
  status: 'REJECTED' | 'REVOKED';
  note: string | null;
  reviewedAt: string;
};

export type AdminCardStats = {
  waiting: number;
  active: number;
  /** Customers who can apply but have not. */
  invited: number;
  /** What the cards have taken off so far (PKR) and in how many checkouts. */
  given: number;
  checkouts: number;
};

export type AdminLoyaltyData = {
  settings: LoyaltyCardSettingsValues;
  stats: AdminCardStats;
  pending: PendingApplication[];
  holders: CardHolder[];
  decisions: CardDecision[];
};

const HOLDER_LIMIT = 100;
const DECISION_LIMIT = 30;

/** Everything on Admin > Loyalty Cards. */
export async function getLoyaltyCardAdminPage(): Promise<AdminLoyaltyData> {
  const customerSelect = { select: { user: { select: { name: true, phone: true, email: true, deletedAt: true } } } } as const;

  const [settings, pending, active, decisions, waiting, activeCount, invited, given] = await Promise.all([
    getCardSettings(),
    prisma.loyaltyCard.findMany({ where: { status: 'PENDING' }, orderBy: { appliedAt: 'asc' }, include: { customer: customerSelect } }),
    prisma.loyaltyCard.findMany({ where: { status: 'APPROVED' }, orderBy: { approvedAt: 'desc' }, take: HOLDER_LIMIT, include: { customer: customerSelect } }),
    prisma.loyaltyCard.findMany({
      where: { status: { in: ['REJECTED', 'REVOKED'] } },
      orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
      take: DECISION_LIMIT,
      include: { customer: customerSelect },
    }),
    prisma.loyaltyCard.count({ where: { status: 'PENDING' } }),
    prisma.loyaltyCard.count({ where: { status: 'APPROVED' } }),
    prisma.loyaltyCard.count({ where: { status: 'ELIGIBLE' } }),
    prisma.loyaltyRedemption.aggregate({ where: { releasedAt: null }, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  // To help decide: what the waiting customers have had delivered, and what the card holders have saved so far.
  const waitingIds = pending.map((card) => card.customerId);
  const holderIds = active.map((card) => card.id);
  const [martDelivered, foodDelivered, saved] = await Promise.all([
    waitingIds.length > 0
      ? prisma.order.groupBy({ by: ['customerId'], where: { customerId: { in: waitingIds }, status: 'DELIVERED' }, _count: { _all: true }, _sum: { totalAmount: true } })
      : [],
    waitingIds.length > 0
      ? prisma.gulplazaOrder.groupBy({ by: ['customerId'], where: { customerId: { in: waitingIds }, status: 'DELIVERED' }, _count: { _all: true }, _sum: { totalAmount: true } })
      : [],
    holderIds.length > 0
      ? prisma.loyaltyRedemption.groupBy({ by: ['cardId'], where: { cardId: { in: holderIds }, releasedAt: null }, _count: { _all: true }, _sum: { amount: true } })
      : [],
  ]);

  const deliveredBy = new Map<string, { count: number; value: number }>();

  for (const row of [...martDelivered, ...foodDelivered]) {
    const current = deliveredBy.get(row.customerId) ?? { count: 0, value: 0 };

    deliveredBy.set(row.customerId, { count: current.count + row._count._all, value: current.value + Number(row._sum.totalAmount ?? 0) });
  }

  const savedBy = new Map(saved.map((row) => [row.cardId, { count: row._count._all, amount: row._sum.amount ?? 0 }]));

  return {
    settings,
    stats: { waiting, active: activeCount, invited, given: given._sum.amount ?? 0, checkouts: given._count._all },
    pending: pending.map((card) => ({
      id: card.id,
      ref: cardRef(card.cardNumber),
      customerName: card.customer.user.name,
      customerPhone: card.customer.user.phone,
      customerEmail: card.customer.user.email,
      accountRemoved: card.customer.user.deletedAt !== null,
      appliedAt: (card.appliedAt ?? card.createdAt).toISOString(),
      delivered: deliveredBy.get(card.customerId)?.count ?? 0,
      itemsValue: deliveredBy.get(card.customerId)?.value ?? 0,
      earlierNote: card.note,
    })),
    holders: active.map((card) => ({
      id: card.id,
      ref: cardRef(card.cardNumber),
      customerName: card.customer.user.name,
      accountRemoved: card.customer.user.deletedAt !== null,
      approvedAt: card.approvedAt?.toISOString() ?? null,
      checkouts: savedBy.get(card.id)?.count ?? 0,
      saved: savedBy.get(card.id)?.amount ?? 0,
    })),
    decisions: decisions.map((card) => ({
      id: card.id,
      ref: cardRef(card.cardNumber),
      customerName: card.customer.user.name,
      status: card.status === 'REVOKED' ? ('REVOKED' as const) : ('REJECTED' as const),
      note: card.note,
      reviewedAt: (card.reviewedAt ?? card.updatedAt).toISOString(),
    })),
  };
}
