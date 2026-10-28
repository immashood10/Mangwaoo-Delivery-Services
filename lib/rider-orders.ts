import { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { startOfKarachiDay } from '@/lib/admin-stats';
import {
  RIDER_HISTORY_FILTERS,
  RIDER_HISTORY_PAGE_SIZE,
  RIDER_HISTORY_RANGES,
  type RiderHistoryFilter,
  type RiderHistoryItem,
  type RiderHistoryRange,
  type RiderHistoryResponse,
  type RiderOrderCancelledBy,
  type RiderRatingSummary,
} from '@/lib/rider-history-types';
import { deliveryChargeForChat } from '@/lib/rider-wallet-config';

// A rider's order history. Every order a rider takes ends in one of three ways, and each leaves one line (RiderOrderRecord):
// delivered (the rider's "Complete order" or the customer's "Order received"), cancelled ("End chat" deletes the chat, so
// the line is the only thing left), or closed by Mangwaoo. Orders still going are read live from the order chats. The
// customer's rating of a delivered ride is kept on the same line, which is where the rider's average rating comes from.

type Db = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a history line keeps of an order: the facts as they were when it ended. */
export type OrderSnapshot = {
  chatId: string;
  riderId: string;
  customerId: string;
  customerName: string;
  pickupText: string | null;
  addressText: string;
  takenAt: Date;
};

export type RiderOrderOutcome =
  | { status: 'DELIVERED'; deliveryCharge: number; commission: number; /** The delivery bonus paid for it (null = none). */ bonus?: number | null }
  /** Closed by Mangwaoo without a delivery being confirmed (an admin closed the chat, the customer's account was removed). */
  | { status: 'CLOSED' }
  | { status: 'CANCELLED'; cancelledBy: RiderOrderCancelledBy };

/** The columns of a chat that `orderSnapshot` needs; spread this into the `select` of the query that loads it. */
export const ORDER_RECORD_CHAT_SELECT = {
  id: true,
  riderId: true,
  customerId: true,
  pickupText: true,
  addressText: true,
  claimedAt: true,
  createdAt: true,
  customer: { select: { userId: true, user: { select: { name: true } } } },
} as const;

type ChatForRecord = Prisma.RiderChatGetPayload<{ select: typeof ORDER_RECORD_CHAT_SELECT }>;

/** The snapshot of an order chat a rider had taken; null when no rider had taken it (then there is no history to write). */
export function orderSnapshot(chat: ChatForRecord): OrderSnapshot | null {
  if (!chat.riderId) return null;

  return {
    chatId: chat.id,
    riderId: chat.riderId,
    customerId: chat.customerId,
    customerName: chat.customer.user.name,
    pickupText: chat.pickupText,
    addressText: chat.addressText,
    takenAt: chat.claimedAt ?? chat.createdAt,
  };
}

/**
 * Writes the history line of an order that is ending. Call it inside the transaction that ends the chat (for a
 * cancellation, before the chat is deleted). `keepExisting` leaves a line that is already there as it is.
 */
export async function recordRiderOrder(db: Db, snapshot: OrderSnapshot, outcome: RiderOrderOutcome, { keepExisting = false } = {}) {
  const ended =
    outcome.status === 'DELIVERED'
      ? { status: 'DELIVERED' as const, cancelledBy: null, deliveryCharge: outcome.deliveryCharge, commission: outcome.commission, bonus: outcome.bonus ?? null }
      : outcome.status === 'CANCELLED'
        ? { status: 'CANCELLED' as const, cancelledBy: outcome.cancelledBy, deliveryCharge: null, commission: null, bonus: null }
        : { status: 'CLOSED' as const, cancelledBy: null, deliveryCharge: null, commission: null, bonus: null };
  const endedAt = new Date();

  await db.riderOrderRecord.upsert({
    where: { chatId: snapshot.chatId },
    create: {
      chatId: snapshot.chatId,
      riderId: snapshot.riderId,
      customerId: snapshot.customerId,
      customerName: snapshot.customerName,
      pickupText: snapshot.pickupText,
      addressText: snapshot.addressText,
      takenAt: snapshot.takenAt,
      endedAt,
      ...ended,
    },
    update: keepExisting ? {} : { ...ended, endedAt },
  });
}

type MissingChatRow = {
  id: string;
  riderId: string;
  customerId: string;
  customerName: string;
  pickupText: string | null;
  addressText: string;
  takenAt: Date;
  endedAt: Date;
};

/**
 * Gives a history line to finished orders that have none: the ones that ended before history was kept (or while an older
 * version of the site was still running). A closed chat that a rider had taken counts as delivered; the charge and the
 * commission come from the rider's wallet ledger when a commission was charged. Scope: all of one rider's chats, or one chat.
 */
export async function reconcileOrderRecords(db: Db, scope: { riderId: string } | { chatId: string }) {
  const which = 'riderId' in scope ? Prisma.sql`c."riderId" = ${scope.riderId}` : Prisma.sql`c."id" = ${scope.chatId} AND c."riderId" IS NOT NULL`;

  const missing = await db.$queryRaw<MissingChatRow[]>(Prisma.sql`
    SELECT c."id", c."riderId", c."customerId", u."name" AS "customerName", c."pickupText", c."addressText",
           COALESCE(c."claimedAt", c."createdAt") AS "takenAt", c."updatedAt" AS "endedAt"
    FROM "RiderChat" c
    JOIN "Customer" cu ON cu."id" = c."customerId"
    JOIN "User" u ON u."id" = cu."userId"
    WHERE ${which} AND c."status" = 'CLOSED'
      AND NOT EXISTS (SELECT 1 FROM "RiderOrderRecord" r WHERE r."chatId" = c."id")`);

  if (missing.length === 0) return;

  const ledger = await db.riderLedgerEntry.findMany({
    where: { type: 'COMMISSION', chatId: { in: missing.map((row) => row.id) } },
    select: { chatId: true, amount: true, baseAmount: true },
  });
  const ledgerByChat = new Map(ledger.flatMap((entry) => (entry.chatId ? [[entry.chatId, entry] as const] : [])));
  const bonusLines = await db.riderLedgerEntry.findMany({
    where: { type: 'BONUS', bonusChatId: { in: missing.map((row) => row.id) } },
    select: { bonusChatId: true, amount: true },
  });
  const bonusByChat = new Map(bonusLines.flatMap((entry) => (entry.bonusChatId ? [[entry.bonusChatId, entry.amount] as const] : [])));

  await db.riderOrderRecord.createMany({
    data: missing.map((row) => {
      const entry = ledgerByChat.get(row.id);

      return {
        chatId: row.id,
        riderId: row.riderId,
        customerId: row.customerId,
        customerName: row.customerName,
        pickupText: row.pickupText,
        addressText: row.addressText,
        status: 'DELIVERED' as const,
        deliveryCharge: entry?.baseAmount ?? null,
        commission: entry ? -entry.amount : null,
        bonus: bonusByChat.get(row.id) ?? null,
        takenAt: row.takenAt,
        endedAt: row.endedAt,
      };
    }),
    skipDuplicates: true,
  });
}

// ── Ratings ──────────────────────────────────────────────────────────────────

/** Each rider's average rating (one decimal) and how many ratings it is made of. Riders nobody has rated are left out. */
export async function getRiderRatings(riderIds: string[]): Promise<Map<string, RiderRatingSummary>> {
  if (riderIds.length === 0) return new Map();

  const rows = await prisma.riderOrderRecord.groupBy({
    by: ['riderId'],
    where: { riderId: { in: [...new Set(riderIds)] }, stars: { not: null } },
    _avg: { stars: true },
    _count: { stars: true },
  });

  return new Map(
    rows.flatMap((row) =>
      row._avg.stars !== null && row._count.stars > 0
        ? [[row.riderId, { average: Math.round(row._avg.stars * 10) / 10, count: row._count.stars }] as const]
        : []
    )
  );
}

export type RateOrderResult =
  | { ok: true; riderUserId: string; riderName: string; customerName: string }
  | { ok: false; status: number; error: string };

/**
 * The customer rates the rider for a delivered order, once (and may add a comment for the rider and a complaint for
 * Mangwaoo). Works from the history line, so it still works after an admin deleted the finished chat.
 */
export async function rateRiderOrder(input: {
  customerId: string;
  chatId: string;
  stars: number;
  comment: string | null;
  complaint: string | null;
}): Promise<RateOrderResult> {
  const { customerId, chatId } = input;

  // An order that finished before history was kept gets its line now.
  await reconcileOrderRecords(prisma, { chatId });

  const record = await prisma.riderOrderRecord.findUnique({
    where: { chatId },
    select: {
      customerId: true,
      customerName: true,
      status: true,
      stars: true,
      rider: { select: { userId: true, user: { select: { name: true } } } },
    },
  });

  if (!record || record.customerId !== customerId) {
    // Same answer for "no such order" and "not yours", so ids can't be probed; an order still going gets its own words.
    const chat = await prisma.riderChat.findUnique({ where: { id: chatId }, select: { customerId: true, status: true } });

    return chat && chat.customerId === customerId && chat.status !== 'CLOSED'
      ? { ok: false, status: 409, error: "This order isn't finished yet. You can rate your rider once it is delivered." }
      : { ok: false, status: 404, error: 'Order not found.' };
  }

  if (record.status !== 'DELIVERED') {
    return { ok: false, status: 409, error: "This order wasn't delivered, so it can't be rated." };
  }

  if (record.stars !== null) {
    return { ok: false, status: 409, error: 'You have already rated this order.' };
  }

  // The guard in `where` makes it once-only even if two requests race.
  const updated = await prisma.riderOrderRecord.updateMany({
    where: { chatId, customerId, status: 'DELIVERED', stars: null },
    data: { stars: input.stars, ratingComment: input.comment, complaint: input.complaint, ratedAt: new Date() },
  });

  if (updated.count === 0) {
    return { ok: false, status: 409, error: 'You have already rated this order.' };
  }

  return { ok: true, riderUserId: record.rider.userId, riderName: record.rider.user.name, customerName: record.customerName };
}

// ── The history screen ───────────────────────────────────────────────────────

export function parseHistoryFilter(value: string | null): RiderHistoryFilter {
  return (RIDER_HISTORY_FILTERS as readonly string[]).includes(value ?? '') ? (value as RiderHistoryFilter) : 'all';
}

export function parseHistoryRange(value: string | null): RiderHistoryRange {
  return (RIDER_HISTORY_RANGES as readonly string[]).includes(value ?? '') ? (value as RiderHistoryRange) : 'all';
}

/** When the range starts (Karachi days: "today" is since midnight there), or null for all time. */
export function historyRangeStart(range: RiderHistoryRange, now: number): Date | null {
  if (range === 'all') return null;

  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;

  return new Date(startOfKarachiDay(now) - (days - 1) * DAY_MS);
}

type Cursor = { endedAt: Date; id: string };

function encodeCursor(cursor: Cursor) {
  return `${cursor.endedAt.toISOString()}|${cursor.id}`;
}

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null;

  const [iso, id] = value.split('|');
  const endedAt = new Date(iso ?? '');

  return id && !Number.isNaN(endedAt.getTime()) ? { endedAt, id } : null;
}

/**
 * The rider's order history: counts, charges, rating, and one page of orders (the ones still going first).
 * `summaryOnly` leaves the orders out (the dashboard's little summary only needs the numbers).
 */
export async function getRiderHistory(
  riderId: string,
  options: { filter: RiderHistoryFilter; range: RiderHistoryRange; cursor: string | null; limit?: number; now?: number; summaryOnly?: boolean }
): Promise<RiderHistoryResponse> {
  const { filter, range } = options;
  const limit = options.limit ?? RIDER_HISTORY_PAGE_SIZE;
  const since = historyRangeStart(range, options.now ?? Date.now());
  const cursor = decodeCursor(options.cursor);

  await reconcileOrderRecords(prisma, { riderId });

  const inRange = { riderId, ...(since ? { endedAt: { gte: since } } : {}) };
  const wantsFinished = filter !== 'pending' && !options.summaryOnly;
  const statusFilter = filter === 'delivered' ? { status: 'DELIVERED' as const } : filter === 'cancelled' ? { status: 'CANCELLED' as const } : {};

  const [counts, delivered, pendingChats, ratings, finished] = await Promise.all([
    prisma.riderOrderRecord.groupBy({ by: ['status'], where: inRange, _count: { _all: true } }),
    prisma.riderOrderRecord.aggregate({ where: { ...inRange, status: 'DELIVERED' }, _sum: { deliveryCharge: true, commission: true, bonus: true } }),
    prisma.riderChat.findMany({
      where: { riderId, status: 'ACTIVE' },
      orderBy: { claimedAt: 'desc' },
      select: {
        id: true,
        pickupText: true,
        addressText: true,
        latitude: true,
        longitude: true,
        pickupLatitude: true,
        pickupLongitude: true,
        deliveryCharge: true,
        claimedAt: true,
        createdAt: true,
        customer: { select: { user: { select: { name: true } } } },
      },
    }),
    getRiderRatings([riderId]),
    wantsFinished
      ? prisma.riderOrderRecord.findMany({
          where: {
            ...inRange,
            ...statusFilter,
            ...(cursor ? { OR: [{ endedAt: { lt: cursor.endedAt } }, { endedAt: cursor.endedAt, id: { lt: cursor.id } }] } : {}),
          },
          orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
        })
      : Promise.resolve([]),
  ]);

  const countOf = (status: 'DELIVERED' | 'CANCELLED' | 'CLOSED') => counts.find((row) => row.status === status)?._count._all ?? 0;

  const page = finished.slice(0, limit);
  const nextCursor = finished.length > limit ? encodeCursor({ endedAt: page[page.length - 1].endedAt, id: page[page.length - 1].id }) : null;

  // The orders still going come first, on the first page only.
  const pendingItems: RiderHistoryItem[] =
    (filter === 'all' || filter === 'pending') && !options.summaryOnly
      ? cursor
        ? []
        : pendingChats.map((chat) => ({
            id: chat.id,
            kind: 'PENDING',
            customerName: chat.customer.user.name,
            pickupText: chat.pickupText,
            addressText: chat.addressText,
            deliveryCharge: deliveryChargeForChat({
              deliveryCharge: chat.deliveryCharge,
              lat: chat.latitude,
              lng: chat.longitude,
              pickupLat: chat.pickupLatitude,
              pickupLng: chat.pickupLongitude,
            }),
            commission: null,
            bonus: null,
            cancelledBy: null,
            takenAt: (chat.claimedAt ?? chat.createdAt).toISOString(),
            endedAt: null,
            stars: null,
            ratingComment: null,
          }))
      : [];

  const finishedItems: RiderHistoryItem[] = page.map((record) => ({
    id: record.id,
    kind: record.status,
    customerName: record.customerName,
    pickupText: record.pickupText,
    addressText: record.addressText,
    deliveryCharge: record.deliveryCharge,
    commission: record.commission,
    bonus: record.bonus,
    cancelledBy: record.cancelledBy,
    takenAt: record.takenAt.toISOString(),
    endedAt: record.endedAt.toISOString(),
    stars: record.stars,
    ratingComment: record.ratingComment,
  }));

  return {
    summary: {
      delivered: countOf('DELIVERED'),
      cancelled: countOf('CANCELLED'),
      closed: countOf('CLOSED'),
      pending: pendingChats.length,
      deliveryCharges: delivered._sum.deliveryCharge ?? 0,
      commission: delivered._sum.commission ?? 0,
      bonus: delivered._sum.bonus ?? 0,
    },
    rating: ratings.get(riderId) ?? null,
    items: [...pendingItems, ...finishedItems],
    nextCursor,
  };
}
