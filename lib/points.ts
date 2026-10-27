import { randomInt } from 'node:crypto';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { orderRef } from '@/lib/order-number';
import { normalizePakistaniMobile, toLocalPhone } from '@/lib/phone';
import {
  CATCH_UP_DAYS,
  DEFAULT_LOYALTY_SETTINGS,
  LOYALTY_START,
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_PENDING_WITHDRAWALS,
  MAX_WITHDRAWAL_PKR,
  PAYOUT_METHODS,
  formatPkr,
  type LoyaltySettingsValues,
  type PayoutMethodKey,
} from '@/lib/points-config';

// Mangwaoo Points (the rules are in lib/points-config.ts). Every change to a customer's points or wallet happens in ONE
// transaction that first locks the customer's row, writes the ledger lines and then re-adds the ledgers into the numbers
// kept on the customer (points, walletBalance), so two clicks at once can never spend the same points or money twice.
// The database also refuses a balance below zero.

type Tx = Prisma.TransactionClient;
export type OrderKindKey = 'MART' | 'GULPLAZA';

const TRANSACTION_OPTIONS = { timeout: 20000, maxWait: 10000 } as const;

export async function getLoyaltySettings(client: Tx | typeof prisma = prisma): Promise<LoyaltySettingsValues> {
  const row = await client.loyaltySettings.findUnique({ where: { id: 'default' } });

  if (!row) return DEFAULT_LOYALTY_SETTINGS;

  return {
    enabled: row.enabled,
    pointsMin: row.pointsMin,
    pointsMax: row.pointsMax,
    redeemPoints: row.redeemPoints,
    cashbackMin: row.cashbackMin,
    cashbackMax: row.cashbackMax,
    minWithdrawal: row.minWithdrawal,
    minOrderAmount: row.minOrderAmount,
  };
}

export async function saveLoyaltySettings(settings: LoyaltySettingsValues) {
  await prisma.loyaltySettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...settings }, update: settings });
}

/** A whole number from `min` to `max`, both included, from the system's secure random source. */
export function drawBetween(min: number, max: number) {
  return randomInt(min, max + 1);
}

async function lockCustomer(tx: Tx, customerId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE`;
}

/** Re-adds both ledgers and stores the totals on the customer. Call inside a transaction that already locked the customer. */
async function recompute(tx: Tx, customerId: string) {
  const [points] = await tx.$queryRaw<{ total: number }[]>`SELECT COALESCE(SUM("points"), 0)::int AS "total" FROM "PointsEntry" WHERE "customerId" = ${customerId}`;
  const [wallet] = await tx.$queryRaw<{ total: number }[]>`SELECT COALESCE(SUM("amount"), 0)::int AS "total" FROM "WalletEntry" WHERE "customerId" = ${customerId}`;

  await tx.customer.update({ where: { id: customerId }, data: { points: points.total, walletBalance: wallet.total } });

  return { points: points.total, walletBalance: wallet.total };
}

// ── Winning points ──────────────────────────────────────────

export type AwardResult =
  | { awarded: true; points: number; ref: string; customerUserId: string; totalPoints: number }
  | { awarded: false; reason: 'OFF' | 'NOT_DELIVERED' | 'NOT_FOUND' | 'TOO_SMALL' | 'ALREADY' };

/**
 * A delivered order wins its customer a random number of points, once: the points line is unique per order, so asking
 * again (a second click, the catch-up, a retry) changes nothing. Orders below the admin's smallest-order rule win nothing.
 */
export async function awardOrderPoints(kind: OrderKindKey, orderId: string): Promise<AwardResult> {
  const order =
    kind === 'MART'
      ? await prisma.order.findUnique({
          where: { id: orderId },
          select: { status: true, orderNumber: true, totalAmount: true, customerId: true, customer: { select: { userId: true } } },
        })
      : await prisma.gulplazaOrder.findUnique({
          where: { id: orderId },
          select: { status: true, orderNumber: true, totalAmount: true, customerId: true, customer: { select: { userId: true } } },
        });

  if (!order) return { awarded: false, reason: 'NOT_FOUND' };
  if (order.status !== 'DELIVERED') return { awarded: false, reason: 'NOT_DELIVERED' };

  const settings = await getLoyaltySettings();

  if (!settings.enabled) return { awarded: false, reason: 'OFF' };
  if (Number(order.totalAmount) < settings.minOrderAmount) return { awarded: false, reason: 'TOO_SMALL' };

  const ref = orderRef(kind, order.orderNumber);

  try {
    return await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, order.customerId);

      const existing = await tx.pointsEntry.findUnique({ where: { orderKind_orderId: { orderKind: kind, orderId } }, select: { id: true } });

      if (existing) return { awarded: false as const, reason: 'ALREADY' as const };

      const points = drawBetween(settings.pointsMin, settings.pointsMax);

      await tx.pointsEntry.create({
        data: { customerId: order.customerId, type: 'EARNED', points, orderKind: kind, orderId, orderRef: ref, note: `Delivered order ${ref}` },
      });

      const totals = await recompute(tx, order.customerId);

      return { awarded: true as const, points, ref, customerUserId: order.customer.userId, totalPoints: totals.points };
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    // Two awards for one order at the very same moment: the unique line let exactly one of them in.
    if ((error as { code?: string })?.code === 'P2002') return { awarded: false, reason: 'ALREADY' };

    throw error;
  }
}

/**
 * Orders that were delivered after the feature started but never got their points (the award failed, or the order was
 * delivered while an older version was live): a customer who opens their points page gets them now. Looks back
 * `CATCH_UP_DAYS` days and never before `LOYALTY_START`.
 */
export async function awardMissingPoints(customerId: string) {
  const since = new Date(Math.max(LOYALTY_START.getTime(), Date.now() - CATCH_UP_DAYS * 24 * 60 * 60 * 1000));
  const where = { customerId, status: 'DELIVERED' as const, deliveredAt: { gte: since } };

  const [mart, food] = await Promise.all([
    prisma.order.findMany({ where, select: { id: true } }),
    prisma.gulplazaOrder.findMany({ where, select: { id: true } }),
  ]);

  if (mart.length + food.length === 0) return [];

  const earned = await prisma.pointsEntry.findMany({
    where: { customerId, type: 'EARNED', orderId: { in: [...mart, ...food].map((order) => order.id) } },
    select: { orderId: true },
  });
  const done = new Set(earned.map((entry) => entry.orderId));
  const missing = [
    ...mart.filter((order) => !done.has(order.id)).map((order) => ({ kind: 'MART' as const, id: order.id })),
    ...food.filter((order) => !done.has(order.id)).map((order) => ({ kind: 'GULPLAZA' as const, id: order.id })),
  ];

  const awards: Extract<AwardResult, { awarded: true }>[] = [];

  for (const order of missing) {
    const result = await awardOrderPoints(order.kind, order.id);
    if (result.awarded) awards.push(result);
  }

  return awards;
}

// ── Cashing in ──────────────────────────────────────────────

export type RedeemResult =
  | { ok: true; cashback: number; points: number; walletBalance: number; cost: number }
  | { ok: false; status: number; error: string };

/** Spends the cost of one cashback (500 points to start with) and puts a random Rs 1 to 10 into the wallet. */
export async function redeemPoints(customerId: string): Promise<RedeemResult> {
  return prisma.$transaction(async (tx): Promise<RedeemResult> => {
    await lockCustomer(tx, customerId);

    // One query at a time: a transaction has a single connection.
    const settings = await getLoyaltySettings(tx);
    const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { points: true } });

    if (!customer) return { ok: false, status: 404, error: 'Customer account not found.' };
    if (!settings.enabled) return { ok: false, status: 403, error: 'Cashing in is paused for now. Your points are safe.' };

    if (customer.points < settings.redeemPoints) {
      return {
        ok: false,
        status: 409,
        error: `You need ${settings.redeemPoints.toLocaleString('en-PK')} points to cash in. You have ${customer.points.toLocaleString('en-PK')}.`,
      };
    }

    const cashback = drawBetween(settings.cashbackMin, settings.cashbackMax);
    const spent = await tx.pointsEntry.create({
      data: { customerId, type: 'REDEEMED', points: -settings.redeemPoints, cashback, note: `Cashed in ${settings.redeemPoints} points` },
    });

    await tx.walletEntry.create({ data: { customerId, type: 'CASHBACK', amount: cashback, note: `Cashback for ${settings.redeemPoints} points (${spent.id.slice(-6)})` } });

    const totals = await recompute(tx, customerId);

    return { ok: true, cashback, points: totals.points, walletBalance: totals.walletBalance, cost: settings.redeemPoints };
  }, TRANSACTION_OPTIONS);
}

// ── Withdrawing to JazzCash / EasyPaisa ─────────────────────

export type WithdrawInput = { amount: unknown; method: unknown; accountNumber: unknown; accountName: unknown };

export type WithdrawResult =
  | { ok: true; withdrawalId: string; amount: number; method: PayoutMethodKey; accountNumber: string; walletBalance: number }
  | { ok: false; status: number; error: string };

/**
 * Takes the money out of the wallet at once and opens a request for an admin to send it to the customer's own account.
 * Whatever is asked for must be in the wallet; a request that is turned down gives the money back.
 */
export async function requestWithdrawal(customerId: string, input: WithdrawInput): Promise<WithdrawResult> {
  const amount = typeof input.amount === 'number' ? input.amount : typeof input.amount === 'string' && input.amount.trim() !== '' ? Number(input.amount) : NaN;
  const method = typeof input.method === 'string' ? input.method : '';
  const mobile = typeof input.accountNumber === 'string' ? normalizePakistaniMobile(input.accountNumber) : null;
  const accountName = typeof input.accountName === 'string' ? input.accountName.replace(/\s+/g, ' ').trim() : '';

  if (!(PAYOUT_METHODS as readonly string[]).includes(method)) {
    return { ok: false, status: 400, error: 'Choose JazzCash or EasyPaisa.' };
  }

  if (!mobile) {
    return { ok: false, status: 400, error: 'Enter the mobile number of your account, like 0300 1234567.' };
  }

  if (accountName.length < 2 || accountName.length > MAX_ACCOUNT_NAME_LENGTH) {
    return { ok: false, status: 400, error: 'Enter the name on that account (2 to 60 letters).' };
  }

  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_WITHDRAWAL_PKR) {
    return { ok: false, status: 400, error: `Enter the amount in whole rupees, up to ${formatPkr(MAX_WITHDRAWAL_PKR)}.` };
  }

  return prisma.$transaction(async (tx): Promise<WithdrawResult> => {
    await lockCustomer(tx, customerId);

    // One query at a time: a transaction has a single connection.
    const settings = await getLoyaltySettings(tx);
    const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { walletBalance: true } });
    const pending = await tx.walletWithdrawal.count({ where: { customerId, status: 'PENDING' } });

    if (!customer) return { ok: false, status: 404, error: 'Customer account not found.' };

    if (amount < settings.minWithdrawal) {
      return { ok: false, status: 400, error: `The least you can withdraw is ${formatPkr(settings.minWithdrawal)}.` };
    }

    if (pending >= MAX_PENDING_WITHDRAWALS) {
      return { ok: false, status: 429, error: 'You already have withdrawals waiting for Mangwaoo to send. Please wait for them first.' };
    }

    if (amount > customer.walletBalance) {
      return { ok: false, status: 409, error: `You only have ${formatPkr(customer.walletBalance)} in your wallet.` };
    }

    const accountNumber = toLocalPhone(mobile);
    const withdrawal = await tx.walletWithdrawal.create({
      data: { customerId, amount, method: method as PayoutMethodKey, accountNumber, accountName },
    });

    await tx.walletEntry.create({
      data: { customerId, type: 'WITHDRAWAL', amount: -amount, withdrawalId: withdrawal.id, note: `To ${method === 'JAZZCASH' ? 'JazzCash' : 'EasyPaisa'} ${accountNumber}` },
    });

    const totals = await recompute(tx, customerId);

    return { ok: true, withdrawalId: withdrawal.id, amount, method: method as PayoutMethodKey, accountNumber, walletBalance: totals.walletBalance };
  }, TRANSACTION_OPTIONS);
}

export type ReviewResult =
  | { ok: true; customerUserId: string; amount: number; method: PayoutMethodKey; accountNumber: string }
  | { ok: false; status: number; error: string };

/** An admin sent the money by hand: the request is paid, with the transaction id of the transfer. */
export async function markWithdrawalPaid(withdrawalId: string, adminId: string, transactionId: string): Promise<ReviewResult> {
  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: withdrawalId },
    select: { amount: true, method: true, accountNumber: true, customer: { select: { userId: true } } },
  });

  if (!withdrawal) return { ok: false, status: 404, error: 'Withdrawal request not found.' };

  // The status guard lets exactly one admin click (or one of "paid" and "rejected") win.
  const claimed = await prisma.walletWithdrawal.updateMany({
    where: { id: withdrawalId, status: 'PENDING' },
    data: { status: 'PAID', transactionId, reviewedById: adminId, reviewedAt: new Date() },
  });

  if (claimed.count === 0) return { ok: false, status: 409, error: 'This request was already reviewed.' };

  return { ok: true, customerUserId: withdrawal.customer.userId, amount: withdrawal.amount, method: withdrawal.method, accountNumber: withdrawal.accountNumber };
}

/** An admin turns the request down: the money goes back into the wallet. */
export async function rejectWithdrawal(withdrawalId: string, adminId: string, reason: string): Promise<ReviewResult> {
  return prisma.$transaction(async (tx): Promise<ReviewResult> => {
    const withdrawal = await tx.walletWithdrawal.findUnique({
      where: { id: withdrawalId },
      select: { customerId: true, amount: true, method: true, accountNumber: true, customer: { select: { userId: true } } },
    });

    if (!withdrawal) return { ok: false, status: 404, error: 'Withdrawal request not found.' };

    await lockCustomer(tx, withdrawal.customerId);

    const claimed = await tx.walletWithdrawal.updateMany({
      where: { id: withdrawalId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectionReason: reason || null, reviewedById: adminId, reviewedAt: new Date() },
    });

    if (claimed.count === 0) return { ok: false, status: 409, error: 'This request was already reviewed.' };

    await tx.walletEntry.create({
      data: { customerId: withdrawal.customerId, type: 'WITHDRAWAL_REFUND', amount: withdrawal.amount, withdrawalId, note: reason ? `Not sent: ${reason}` : 'Not sent' },
    });
    await recompute(tx, withdrawal.customerId);

    return { ok: true, customerUserId: withdrawal.customer.userId, amount: withdrawal.amount, method: withdrawal.method, accountNumber: withdrawal.accountNumber };
  }, TRANSACTION_OPTIONS);
}

/**
 * What happens to a customer's points and wallet when an admin deletes the account: waiting withdrawals are turned down
 * (nothing is sent to a removed account) and both balances are written off with a line each, so the ledgers still add up.
 */
export async function closeCustomerPoints(tx: Tx, customerId: string) {
  await lockCustomer(tx, customerId);

  const pending = await tx.walletWithdrawal.findMany({ where: { customerId, status: 'PENDING' }, select: { id: true, amount: true } });

  // The money of those requests had left the wallet already: it goes back as a line, then everything is written off.
  for (const withdrawal of pending) {
    const turnedDown = await tx.walletWithdrawal.updateMany({
      where: { id: withdrawal.id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectionReason: 'The account was removed.', reviewedAt: new Date() },
    });

    if (turnedDown.count > 0) {
      await tx.walletEntry.create({ data: { customerId, type: 'WITHDRAWAL_REFUND', amount: withdrawal.amount, withdrawalId: withdrawal.id, note: 'The account was removed' } });
    }
  }

  const totals = await recompute(tx, customerId);

  if (totals.walletBalance > 0) {
    await tx.walletEntry.create({ data: { customerId, type: 'ADJUSTMENT', amount: -totals.walletBalance, note: 'The account was removed' } });
  }

  if (totals.points > 0) {
    await tx.pointsEntry.create({ data: { customerId, type: 'ADJUSTMENT', points: -totals.points, note: 'The account was removed' } });
  }

  await recompute(tx, customerId);
}

// ── What the pages show ─────────────────────────────────────

export type ActivityLine =
  | { id: string; at: string; kind: 'POINTS'; type: 'EARNED' | 'REDEEMED' | 'ADJUSTMENT'; points: number; cashback: number | null; note: string | null; orderRef: string | null }
  | { id: string; at: string; kind: 'WALLET'; type: 'CASHBACK' | 'WITHDRAWAL' | 'WITHDRAWAL_REFUND' | 'ADJUSTMENT'; amount: number; note: string | null };

export type WithdrawalView = {
  id: string;
  amount: number;
  method: PayoutMethodKey;
  accountNumber: string;
  accountName: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  transactionId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type PointsPageData = {
  points: number;
  walletBalance: number;
  /** Every point ever won (not counting what was spent). */
  totalEarned: number;
  /** Cashback ever won, in PKR. */
  totalCashback: number;
  settings: LoyaltySettingsValues;
  activity: ActivityLine[];
  withdrawals: WithdrawalView[];
};

const ACTIVITY_LIMIT = 40;

/** Everything on a customer's Mangwaoo Points page. */
export async function getPointsPage(customerId: string): Promise<PointsPageData> {
  const [customer, settings, pointLines, walletLines, withdrawals, earned, cashback] = await Promise.all([
    prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { points: true, walletBalance: true } }),
    getLoyaltySettings(),
    prisma.pointsEntry.findMany({ where: { customerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: ACTIVITY_LIMIT }),
    prisma.walletEntry.findMany({ where: { customerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: ACTIVITY_LIMIT }),
    prisma.walletWithdrawal.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.pointsEntry.aggregate({ where: { customerId, type: 'EARNED' }, _sum: { points: true } }),
    prisma.walletEntry.aggregate({ where: { customerId, type: 'CASHBACK' }, _sum: { amount: true } }),
  ]);

  const activity: ActivityLine[] = [
    ...pointLines.map((line): ActivityLine => ({
      id: `p-${line.id}`,
      at: line.createdAt.toISOString(),
      kind: 'POINTS',
      type: line.type,
      points: line.points,
      cashback: line.cashback,
      note: line.note,
      orderRef: line.orderRef,
    })),
    ...walletLines
      // The cashback line is shown with the points that bought it; the others are the wallet's own story.
      .filter((line) => line.type !== 'CASHBACK')
      .map((line): ActivityLine => ({ id: `w-${line.id}`, at: line.createdAt.toISOString(), kind: 'WALLET', type: line.type, amount: line.amount, note: line.note })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, ACTIVITY_LIMIT);

  return {
    points: customer.points,
    walletBalance: customer.walletBalance,
    totalEarned: earned._sum.points ?? 0,
    totalCashback: cashback._sum.amount ?? 0,
    settings,
    activity,
    withdrawals: withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      amount: withdrawal.amount,
      method: withdrawal.method,
      accountNumber: withdrawal.accountNumber,
      accountName: withdrawal.accountName,
      status: withdrawal.status,
      transactionId: withdrawal.transactionId,
      rejectionReason: withdrawal.rejectionReason,
      createdAt: withdrawal.createdAt.toISOString(),
      reviewedAt: withdrawal.reviewedAt?.toISOString() ?? null,
    })),
  };
}
