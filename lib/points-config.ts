// Mangwaoo Points rules shared by the API routes, the customer's page and the admin page (client-safe, no database).
//
// How it works: every delivered order wins the customer a random number of points (1 to 100 to start with). A set number
// of points (500 to start with) can be cashed in for a random cashback (Rs 1 to 10 to start with), which goes into the
// customer's wallet. The customer can ask for the wallet's money to be sent to their own JazzCash or EasyPaisa account
// whenever they like: an admin sends it by hand and marks the request paid. An admin can change every number.

import { formatPkr } from '@/lib/rider-wallet-config';

export { formatPkr };

export type LoyaltySettingsValues = {
  /** Off = no new points and no cashing in; balances stay and withdrawals still work. */
  enabled: boolean;
  pointsMin: number;
  pointsMax: number;
  /** Points one cashback costs. */
  redeemPoints: number;
  cashbackMin: number;
  cashbackMax: number;
  /** The least a customer can withdraw at once (PKR). */
  minWithdrawal: number;
  /** Orders with items worth less than this win no points (PKR, 0 = every delivered order wins). */
  minOrderAmount: number;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettingsValues = {
  enabled: true,
  pointsMin: 1,
  pointsMax: 100,
  redeemPoints: 500,
  cashbackMin: 1,
  cashbackMax: 10,
  minWithdrawal: 1,
  minOrderAmount: 0,
};

/** The largest values an admin can save (a typing slip like 1000000 points per order is refused). */
export const LOYALTY_LIMITS = {
  pointsMax: 10000,
  redeemPoints: 1000000,
  cashbackMax: 1000,
  minWithdrawal: 100000,
  minOrderAmount: 100000,
} as const;

/** The most a customer can withdraw in one request (PKR). */
export const MAX_WITHDRAWAL_PKR = 100000;
/** Requests waiting for Mangwaoo to send the money, per customer. */
export const MAX_PENDING_WITHDRAWALS = 3;
export const MAX_ACCOUNT_NAME_LENGTH = 60;
export const MAX_REJECTION_REASON_LENGTH = 200;

/**
 * Points are only won by orders delivered from this day on (Karachi time): orders finished before the feature existed
 * don't win anything retroactively.
 */
export const LOYALTY_START = new Date('2026-10-28T00:00:00+05:00');
/** How far back the catch-up looks for delivered orders that missed their points. */
export const CATCH_UP_DAYS = 60;

export const PAYOUT_METHODS = ['EASYPAISA', 'JAZZCASH'] as const;
export type PayoutMethodKey = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_LABELS: Record<PayoutMethodKey, string> = { EASYPAISA: 'EasyPaisa', JAZZCASH: 'JazzCash' };

export type PointsEntryKind = 'EARNED' | 'REDEEMED' | 'ADJUSTMENT';
export type WalletEntryKind = 'CASHBACK' | 'WITHDRAWAL' | 'WITHDRAWAL_REFUND' | 'ADJUSTMENT';
export type WithdrawalState = 'PENDING' | 'PAID' | 'REJECTED';

export const WALLET_ENTRY_LABELS: Record<WalletEntryKind, string> = {
  CASHBACK: 'Cashback',
  WITHDRAWAL: 'Withdrawal',
  WITHDRAWAL_REFUND: 'Withdrawal returned',
  ADJUSTMENT: 'Adjustment',
};

export function formatPoints(points: number) {
  return points.toLocaleString('en-PK');
}

/** "1 to 100", or just "5" when both ends are the same. */
export function rangeLabel(min: number, max: number) {
  return min === max ? String(min) : `${min} to ${max}`;
}

type SettingsInput = Partial<Record<keyof LoyaltySettingsValues, unknown>> | null | undefined;

const toWhole = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);

/** What an admin sent as the rules: checked, with a message for the first problem. */
export function parseLoyaltySettings(input: SettingsInput): { settings: LoyaltySettingsValues } | { error: string } {
  const pointsMin = toWhole(input?.pointsMin);
  const pointsMax = toWhole(input?.pointsMax);
  const redeemPoints = toWhole(input?.redeemPoints);
  const cashbackMin = toWhole(input?.cashbackMin);
  const cashbackMax = toWhole(input?.cashbackMax);
  const minWithdrawal = toWhole(input?.minWithdrawal);
  const minOrderAmount = toWhole(input?.minOrderAmount);

  if (typeof input?.enabled !== 'boolean') return { error: 'Choose whether Mangwaoo Points are on or off.' };

  if (!Number.isInteger(pointsMin) || !Number.isInteger(pointsMax) || pointsMin < 1 || pointsMax < pointsMin || pointsMax > LOYALTY_LIMITS.pointsMax) {
    return { error: `Points per order must be whole numbers from 1 up to ${LOYALTY_LIMITS.pointsMax.toLocaleString('en-PK')}, and the highest can't be below the lowest.` };
  }

  if (!Number.isInteger(redeemPoints) || redeemPoints < 1 || redeemPoints > LOYALTY_LIMITS.redeemPoints) {
    return { error: `Points needed for a cashback must be a whole number from 1 to ${LOYALTY_LIMITS.redeemPoints.toLocaleString('en-PK')}.` };
  }

  if (!Number.isInteger(cashbackMin) || !Number.isInteger(cashbackMax) || cashbackMin < 1 || cashbackMax < cashbackMin || cashbackMax > LOYALTY_LIMITS.cashbackMax) {
    return { error: `Cashback must be whole rupees from 1 up to ${LOYALTY_LIMITS.cashbackMax.toLocaleString('en-PK')}, and the highest can't be below the lowest.` };
  }

  if (!Number.isInteger(minWithdrawal) || minWithdrawal < 1 || minWithdrawal > LOYALTY_LIMITS.minWithdrawal) {
    return { error: `The least a customer can withdraw must be a whole number of rupees from 1 to ${LOYALTY_LIMITS.minWithdrawal.toLocaleString('en-PK')}.` };
  }

  if (!Number.isInteger(minOrderAmount) || minOrderAmount < 0 || minOrderAmount > LOYALTY_LIMITS.minOrderAmount) {
    return { error: `The smallest order that wins points must be a whole number of rupees from 0 to ${LOYALTY_LIMITS.minOrderAmount.toLocaleString('en-PK')}.` };
  }

  return { settings: { enabled: input.enabled, pointsMin, pointsMax, redeemPoints, cashbackMin, cashbackMax, minWithdrawal, minOrderAmount } };
}
