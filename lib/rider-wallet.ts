import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { billedDistanceKm } from '@/lib/delivery';
import { distanceInKm } from '@/lib/geo';
import { drawBonus, getBonusSettings } from '@/lib/rider-bonus';
import type { BonusTier } from '@/lib/rider-bonus-config';
import { ORDER_RECORD_CHAT_SELECT, orderSnapshot, recordRiderOrder } from '@/lib/rider-orders';
import {
  DEFAULT_COMMISSION_PERCENT,
  DEFAULT_ORDERS_ON_CREDIT,
  commissionFor,
  deliveryChargeForChat,
  type RiderOrderAccess,
} from '@/lib/rider-wallet-config';

// The rider's wallet (see lib/rider-wallet-config.ts for the rules). Every change to a rider's money happens in ONE
// transaction that first locks the rider's row, writes the ledger line and then recomputes the numbers kept on the
// rider (walletBalance, unpaidOrders, paymentHold), so two orders finishing at once can't miscount.

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { timeout: 20000, maxWait: 10000 } as const;

export async function getWalletSettings(client: Tx | typeof prisma = prisma) {
  const row = await client.riderWalletSettings.findUnique({ where: { id: 'default' } });

  return {
    commissionPercent: row?.commissionPercent ?? DEFAULT_COMMISSION_PERCENT,
    ordersOnCredit: row?.ordersOnCredit ?? DEFAULT_ORDERS_ON_CREDIT,
  };
}

async function lockRider(tx: Tx, riderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Rider" WHERE "id" = ${riderId} FOR UPDATE`;
}

export type WalletChange = {
  balance: number;
  unpaidOrders: number;
  paymentHold: boolean;
  orderAccess: RiderOrderAccess;
  /** The wallet rule just put the rider on hold. */
  startedHold: boolean;
  /** The rider has paid up and the wallet rule released them. */
  endedHold: boolean;
};

/**
 * Re-adds the rider's ledger and stores the result on the rider: the balance (negative = owes Mangwaoo), how many
 * finished orders are still unpaid (payments cover the oldest commission first) and the payment hold. The hold starts
 * when unpaid orders reach the limit and lasts until the balance is back to zero or more (`relax` also lets it go once
 * unpaid orders fall below a raised limit — used when an admin changes the rule). Call inside a transaction that
 * already locked the rider.
 */
async function recomputeWallet(tx: Tx, riderId: string, options: { relax?: boolean } = {}): Promise<WalletChange> {
  const [sums] = await tx.$queryRaw<{ balance: number; credits: number }[]>`
    SELECT COALESCE(SUM("amount"), 0)::int AS "balance",
           COALESCE(SUM("amount") FILTER (WHERE "type" <> 'COMMISSION'), 0)::int AS "credits"
    FROM "RiderLedgerEntry" WHERE "riderId" = ${riderId}`;

  // Commission lines oldest first; a line is unpaid while the commission up to it adds up to more than what was paid.
  const [counted] = await tx.$queryRaw<{ unpaid: number }[]>`
    SELECT COUNT(*)::int AS "unpaid" FROM (
      SELECT SUM(-"amount") OVER (ORDER BY "createdAt", "id") AS "cumulative"
      FROM "RiderLedgerEntry" WHERE "riderId" = ${riderId} AND "type" = 'COMMISSION'
    ) AS "lines" WHERE "cumulative" > ${sums.credits}`;

  const [settings, rider] = await Promise.all([
    getWalletSettings(tx),
    tx.rider.findUniqueOrThrow({ where: { id: riderId }, select: { paymentHold: true, orderAccess: true } }),
  ]);

  const balance = sums.balance;
  const unpaidOrders = counted.unpaid;
  let paymentHold = rider.paymentHold;

  if (balance >= 0) {
    paymentHold = false;
  } else if (!paymentHold && unpaidOrders >= settings.ordersOnCredit) {
    paymentHold = true;
  } else if (options.relax && unpaidOrders < settings.ordersOnCredit) {
    paymentHold = false;
  }

  const startedHold = paymentHold && !rider.paymentHold;

  await tx.rider.update({
    where: { id: riderId },
    data: {
      walletBalance: balance,
      unpaidOrders,
      paymentHold,
      // A rider who just lost the right to orders goes offline at once (an admin's "always allowed" keeps them on).
      ...(startedHold && rider.orderAccess === 'AUTO' ? { isAvailable: false, lastSeenAt: null } : {}),
    },
  });

  return {
    balance,
    unpaidOrders,
    paymentHold,
    orderAccess: rider.orderAccess,
    startedHold,
    endedHold: !paymentHold && rider.paymentHold,
  };
}

export type CommissionResult = {
  riderId: string;
  riderUserId: string;
  riderName: string;
  /** What Mangwaoo takes for this order, in PKR (0 = nothing could be worked out, no line was written). */
  commission: number;
  baseFee: number;
  percent: number;
  change: WalletChange | null;
};

/** The delivery bonus paid for an order (lib/rider-bonus.ts): the amount, the tier and the distance it was judged by (null = not known). */
export type BonusResult = { amount: number; tier: BonusTier; distanceKm: number | null };

export type CloseResult = {
  /** false when the chat no longer exists (it was cancelled in the meantime). */
  found: boolean;
  /** The commission charged to the rider; null when nothing was charged. */
  commission: CommissionResult | null;
  /** The delivery bonus this call paid to the rider; null when none was (an admin's close, bonuses off, a chat that was already closed). */
  bonus: BonusResult | null;
  /** Set when this call ended an order a rider had taken (so the customer can be told, and asked to rate the rider). */
  finished: { riderName: string; customerUserId: string; customerName: string } | null;
};

/**
 * Finishes an order chat. With `charge`, a chat that a rider had claimed (ACTIVE) also charges the rider Mangwaoo's
 * commission, exactly once: the percentage of the chat's delivery charge, which the server already knows
 * (`deliveryChargeForChat`: the delivery fee of the checkout that opened it, or the delivery rate for the ride's
 * distance), so the rider types nothing. That is what a delivered order is: the rider's "Complete order" or the
 * customer's "Order received". Without `charge` (an admin closing a chat) it only closes it; so does closing a chat
 * nobody claimed or one that is already closed. A cancelled order never comes through here: `cancelOrderChat` deletes it.
 * The order's line in the rider's history (lib/rider-orders.ts) is written in the same transaction: delivered, or
 * closed by Mangwaoo. A delivered order also pays the rider a random delivery bonus (a BONUS line, lib/rider-bonus.ts),
 * judged by the distance of the ride: it is positive money, set off against the commission, and exactly once like it.
 */
export async function closeOrderChat(chatId: string, options: { charge: boolean }): Promise<CloseResult> {
  const { charge } = options;

  return prisma.$transaction(async (tx) => {
    const closed = await tx.riderChat.updateMany({ where: { id: chatId, status: 'ACTIVE' }, data: { status: 'CLOSED' } });

    if (closed.count === 0) {
      const existing = await tx.riderChat.findUnique({ where: { id: chatId }, select: { status: true } });

      if (!existing) return { found: false, commission: null, bonus: null, finished: null };

      if (existing.status === 'OPEN') {
        await tx.riderChat.updateMany({ where: { id: chatId, status: 'OPEN' }, data: { status: 'CLOSED' } });
      }

      return { found: true, commission: null, bonus: null, finished: null };
    }

    const chat = await tx.riderChat.findUnique({
      where: { id: chatId },
      select: {
        ...ORDER_RECORD_CHAT_SELECT,
        latitude: true,
        longitude: true,
        pickupLatitude: true,
        pickupLongitude: true,
        deliveryCharge: true,
        deliveryDistanceKm: true,
        rider: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    const snapshot = chat ? orderSnapshot(chat) : null;

    if (!chat || !snapshot || !chat.rider) return { found: true, commission: null, bonus: null, finished: null };

    const finished = { riderName: chat.rider.user.name, customerUserId: chat.customer.userId, customerName: snapshot.customerName };

    // An admin closing a chat only closes it: no commission, no bonus, and the rider's history says Mangwaoo closed it.
    if (!charge) {
      await recordRiderOrder(tx, snapshot, { status: 'CLOSED' });

      return { found: true, commission: null, bonus: null, finished };
    }

    await lockRider(tx, snapshot.riderId);

    const settings = await getWalletSettings(tx);
    const baseFee = deliveryChargeForChat({
      deliveryCharge: chat.deliveryCharge,
      lat: chat.latitude,
      lng: chat.longitude,
      pickupLat: chat.pickupLatitude,
      pickupLng: chat.pickupLongitude,
    });
    const commission = Math.max(0, commissionFor(baseFee, settings.commissionPercent));
    const result = {
      riderId: snapshot.riderId,
      riderUserId: chat.rider.userId,
      riderName: chat.rider.user.name,
      commission,
      baseFee,
      percent: settings.commissionPercent,
    };

    // The delivery bonus: a random amount by the distance of the ride (the one the chat remembers, or pickup → drop-off for a
    // request with a pickup point; unknown counts as the first tier). One per order: this transaction is the only one that
    // gets past the status guard above, and `bonusChatId` is unique as a second safety.
    const bonusSettings = await getBonusSettings(tx);
    const distanceKm =
      chat.deliveryDistanceKm ??
      (chat.pickupLatitude !== null && chat.pickupLongitude !== null
        ? billedDistanceKm(distanceInKm({ lat: chat.pickupLatitude, lng: chat.pickupLongitude }, { lat: chat.latitude, lng: chat.longitude }))
        : null);
    const bonus: BonusResult | null = bonusSettings.enabled ? { ...drawBonus(distanceKm, bonusSettings), distanceKm } : null;

    if (commission > 0) {
      await tx.riderLedgerEntry.create({
        data: {
          riderId: snapshot.riderId,
          type: 'COMMISSION',
          amount: -commission,
          baseAmount: baseFee,
          chatId,
          note: `${settings.commissionPercent}% of Rs ${baseFee.toLocaleString('en-PK')} delivery charge · order for ${snapshot.customerName}`,
        },
      });
    }

    if (bonus) {
      await tx.riderLedgerEntry.create({
        data: {
          riderId: snapshot.riderId,
          type: 'BONUS',
          amount: bonus.amount,
          bonusChatId: chatId,
          note: `Delivery bonus${bonus.distanceKm !== null ? ` · ${bonus.distanceKm} km` : ''} · order for ${snapshot.customerName}`,
        },
      });
    }

    await recordRiderOrder(tx, snapshot, { status: 'DELIVERED', deliveryCharge: baseFee, commission, bonus: bonus?.amount ?? null });

    // A line was written (a commission, a bonus or both): the rider's numbers and the payment hold follow it.
    const change = commission > 0 || bonus ? await recomputeWallet(tx, snapshot.riderId) : null;

    return { found: true, commission: { ...result, change }, bonus, finished };
  }, TRANSACTION_OPTIONS);
}

/** A payment the admin received (cash or transfer), or a correction either way. Returns the rider's new standing. */
export async function addLedgerEntry(input: {
  riderId: string;
  type: 'TOP_UP' | 'ADJUSTMENT';
  /** PKR from the rider's side: positive adds money, negative takes some away. */
  amount: number;
  note: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await lockRider(tx, input.riderId);
    await tx.riderLedgerEntry.create({
      data: { riderId: input.riderId, type: input.type, amount: input.amount, note: input.note },
    });

    return recomputeWallet(tx, input.riderId);
  }, TRANSACTION_OPTIONS);
}

export type TopUpReview =
  | { ok: true; riderId: string; riderUserId: string; amount: number; change: WalletChange | null }
  | { ok: false; status: number; error: string };

/** Approves a rider's recharge request (the admin may correct the amount) and adds the money to the wallet. */
export async function approveTopUp(topUpId: string, amountOverride: number | null): Promise<TopUpReview> {
  return prisma.$transaction(async (tx) => {
    const topUp = await tx.riderTopUp.findUnique({
      where: { id: topUpId },
      include: { rider: { select: { userId: true } } },
    });

    if (!topUp) return { ok: false as const, status: 404, error: 'Recharge request not found.' };
    if (topUp.status !== 'PENDING') return { ok: false as const, status: 409, error: 'This request was already reviewed.' };

    await lockRider(tx, topUp.riderId);

    const duplicate = await tx.riderTopUp.findFirst({
      where: { transactionId: topUp.transactionId, status: 'APPROVED', id: { not: topUpId } },
      select: { id: true },
    });

    if (duplicate) {
      return { ok: false as const, status: 409, error: 'This transaction ID was already approved for another recharge.' };
    }

    const amount = amountOverride ?? topUp.amount;
    const claimed = await tx.riderTopUp.updateMany({
      where: { id: topUpId, status: 'PENDING' },
      data: { status: 'APPROVED', reviewedAt: new Date(), amount },
    });

    if (claimed.count === 0) return { ok: false as const, status: 409, error: 'This request was already reviewed.' };

    await tx.riderLedgerEntry.create({
      data: {
        riderId: topUp.riderId,
        type: 'TOP_UP',
        amount,
        topUpId,
        note: `${topUp.method} · ${topUp.transactionId}`,
      },
    });

    return {
      ok: true as const,
      riderId: topUp.riderId,
      riderUserId: topUp.rider.userId,
      amount,
      change: await recomputeWallet(tx, topUp.riderId),
    };
  }, TRANSACTION_OPTIONS);
}

/**
 * Saves a new commission rule, then re-checks every rider who owes money or is on hold (a lower limit can put riders
 * on hold; a higher one releases those below it). Past orders keep the commission they were charged.
 */
export async function saveWalletSettings(commissionPercent: number, ordersOnCredit: number) {
  await prisma.riderWalletSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default', commissionPercent, ordersOnCredit },
    update: { commissionPercent, ordersOnCredit },
  });

  const riders = await prisma.rider.findMany({
    where: { OR: [{ walletBalance: { lt: 0 } }, { paymentHold: true }] },
    select: { id: true, user: { select: { id: true } } },
  });
  const changes: { riderId: string; riderUserId: string; change: WalletChange }[] = [];

  for (const rider of riders) {
    const change = await prisma.$transaction(async (tx) => {
      await lockRider(tx, rider.id);

      return recomputeWallet(tx, rider.id, { relax: true });
    }, TRANSACTION_OPTIONS);

    if (change.startedHold || change.endedHold) changes.push({ riderId: rider.id, riderUserId: rider.user.id, change });
  }

  return changes;
}

/** Stores an admin's override (always allow / block). Blocking also sends the rider offline. */
export async function setOrderAccess(riderId: string, access: RiderOrderAccess) {
  return prisma.rider.update({
    where: { id: riderId },
    data: access === 'BLOCKED' ? { orderAccess: access, isAvailable: false, lastSeenAt: null } : { orderAccess: access },
    select: { orderAccess: true, paymentHold: true, walletBalance: true, unpaidOrders: true },
  });
}
