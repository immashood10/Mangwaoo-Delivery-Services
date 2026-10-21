import type { Prisma } from '@/lib/generated/prisma/client';

// Coupons are made by the admin (Admin > Discount) and applied by customers in the cart. This file holds what the
// admin screens, the admin API and checkout all need to agree on.

export type CouponScope = 'ALL' | 'FOOD' | 'MART';

export const COUPON_SCOPES: CouponScope[] = ['ALL', 'FOOD', 'MART'];

export const COUPON_SCOPE_LABELS: Record<CouponScope, string> = {
  ALL: 'Everything (food and MangwaooMart)',
  FOOD: 'Food only',
  MART: 'MangwaooMart only',
};

export const MAX_COUPON_DESCRIPTION_LENGTH = 80;

/** A coupon row as the admin screen shows it (numbers, ISO dates). */
export type AdminCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountPercent: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  appliesTo: CouponScope;
  onePerCustomer: boolean;
  maxUses: number | null;
  usedCount: number;
  /** The Karachi day it works until (YYYY-MM-DD), or null. */
  expiresOn: string | null;
  isActive: boolean;
  createdAt: string;
  status: CouponStatus;
};

export type CouponStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'USED_UP';

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  USED_UP: 'Used up',
};

// Karachi has no daylight saving, so its offset is fixed.
const KARACHI_OFFSET = '+05:00';
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

/** A coupon "valid until 25 Oct" works through the whole of that day in Karachi. */
export function expiryFromKarachiDate(day: string) {
  return new Date(`${day}T23:59:59.999${KARACHI_OFFSET}`);
}

export function karachiDateOf(date: Date) {
  return new Date(date.getTime() + KARACHI_OFFSET_MS).toISOString().slice(0, 10);
}

export function couponStatusOf(
  coupon: { isActive: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number },
  now = new Date()
): CouponStatus {
  if (!coupon.isActive) return 'PAUSED';
  if (coupon.expiresAt && coupon.expiresAt <= now) return 'EXPIRED';
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) return 'USED_UP';

  return 'ACTIVE';
}

type CouponRow = Prisma.CouponGetPayload<object>;

export function toAdminCoupon(coupon: CouponRow, now = new Date()): AdminCoupon {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description,
    discountPercent: coupon.discountPercent,
    maxDiscountAmount: coupon.maxDiscountAmount === null ? null : Number(coupon.maxDiscountAmount),
    minOrderAmount: coupon.minOrderAmount === null ? null : Number(coupon.minOrderAmount),
    appliesTo: coupon.appliesTo,
    onePerCustomer: coupon.onePerCustomer,
    maxUses: coupon.maxUses,
    usedCount: coupon.usedCount,
    expiresOn: coupon.expiresAt ? karachiDateOf(coupon.expiresAt) : null,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(),
    status: couponStatusOf(coupon, now),
  };
}

/** "save10", " Save-10 " → "SAVE-10"; null when it isn't 3 to 20 letters, digits, "-" or "_". */
export function normalizeCouponCode(input: unknown) {
  if (typeof input !== 'string') return null;

  const code = input.trim().toUpperCase();

  return /^[A-Z0-9_-]{3,20}$/.test(code) ? code : null;
}

export type CouponInput = {
  code: string;
  description: string | null;
  discountPercent: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  appliesTo: CouponScope;
  onePerCustomer: boolean;
  maxUses: number | null;
  expiresAt: Date | null;
  isActive: boolean;
};

const blank = (value: unknown) => value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/** Reads an optional whole-PKR amount: blank = none. Returns undefined when it is not a valid amount. */
function optionalAmount(value: unknown) {
  if (blank(value)) return null;

  const amount = Number(value);

  return Number.isFinite(amount) && amount > 0 && amount <= 10_000_000 ? Math.round(amount) : undefined;
}

/** Checks what the admin typed in the coupon form. */
export function parseCouponInput(body: unknown): { ok: true; data: CouponInput } | { ok: false; error: string } {
  const record = (body ?? {}) as Record<string, unknown>;

  const code = normalizeCouponCode(record.code);
  if (!code) return { ok: false, error: 'The coupon code needs 3 to 20 letters, digits, "-" or "_" (e.g. EID25).' };

  const discountPercent = Number(record.discountPercent);
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return { ok: false, error: 'Discount % must be more than 0 and at most 100.' };
  }

  const maxDiscountAmount = optionalAmount(record.maxDiscountAmount);
  if (maxDiscountAmount === undefined) return { ok: false, error: 'Max discount must be a positive amount in PKR, or left empty.' };

  const minOrderAmount = optionalAmount(record.minOrderAmount);
  if (minOrderAmount === undefined) return { ok: false, error: 'Minimum order must be a positive amount in PKR, or left empty.' };

  const appliesTo = COUPON_SCOPES.includes(record.appliesTo as CouponScope) ? (record.appliesTo as CouponScope) : null;
  if (!appliesTo) return { ok: false, error: 'Choose what the coupon applies to.' };

  let maxUses: number | null = null;
  if (!blank(record.maxUses)) {
    maxUses = Number(record.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000) {
      return { ok: false, error: 'Usage limit must be a whole number of at least 1, or left empty.' };
    }
  }

  let expiresAt: Date | null = null;
  if (!blank(record.expiresOn)) {
    if (typeof record.expiresOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.expiresOn)) {
      return { ok: false, error: 'Pick the last day the coupon works, or leave the date empty.' };
    }

    expiresAt = expiryFromKarachiDate(record.expiresOn);
    if (Number.isNaN(expiresAt.getTime())) return { ok: false, error: 'That expiry date is not a real date.' };
  }

  const description = typeof record.description === 'string' ? record.description.trim().replace(/\s+/g, ' ') : '';
  if (description.length > MAX_COUPON_DESCRIPTION_LENGTH) {
    return { ok: false, error: `The note can be up to ${MAX_COUPON_DESCRIPTION_LENGTH} characters.` };
  }

  return {
    ok: true,
    data: {
      code,
      description: description || null,
      // Two decimals are plenty (12.5 % is fine, 12.3456 % is not meaningful)
      discountPercent: Math.round(discountPercent * 100) / 100,
      maxDiscountAmount,
      minOrderAmount,
      appliesTo,
      onePerCustomer: record.onePerCustomer !== false,
      maxUses,
      expiresAt,
      isActive: record.isActive !== false,
    },
  };
}

/**
 * A checkout that used a coupon gives its use back once every order it created has been cancelled
 * (by the customer or the seller). Call it inside the transaction that cancels an order.
 */
export async function releaseCouponIfUnused(tx: Prisma.TransactionClient, redemptionId: string | null) {
  if (!redemptionId) return;

  const [martLeft, foodLeft] = await Promise.all([
    tx.order.count({ where: { redemptionId, status: { not: 'CANCELLED' } } }),
    tx.gulplazaOrder.count({ where: { redemptionId, status: { not: 'CANCELLED' } } }),
  ]);

  if (martLeft + foodLeft > 0) return;

  // The null guard makes this happen once even if the last two orders are cancelled at the same moment.
  const released = await tx.couponRedemption.updateMany({
    where: { id: redemptionId, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });

  if (released.count === 0) return;

  const redemption = await tx.couponRedemption.findUnique({ where: { id: redemptionId }, select: { couponId: true } });

  if (redemption) {
    await tx.coupon.update({ where: { id: redemption.couponId }, data: { usedCount: { decrement: 1 } } });
  }
}
