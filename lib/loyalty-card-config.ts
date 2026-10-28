// Mangwaoo Loyalty Card rules shared by checkout, the API routes, the customer's page and the admin page (client-safe, no
// database).
//
// How it works: once enough of a customer's orders have been delivered (20 to start with) they are told they can apply for
// the Loyalty Card. An admin approves the application. From then on every order the customer places gets a random
// discount (1 to 10 % to start with) off its items, paid by Mangwaoo, not the seller (never off the delivery fee). An
// admin can change every number, and can take a card back.

export type LoyaltyCardStatusKey = 'ELIGIBLE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export const LOYALTY_CARD_STATUS_LABELS: Record<LoyaltyCardStatusKey, string> = {
  ELIGIBLE: 'Can apply',
  PENDING: 'Waiting for approval',
  APPROVED: 'Active',
  REJECTED: 'Not approved',
  REVOKED: 'Taken back',
};

export type LoyaltyCardSettingsValues = {
  /** Off = no new invitations or applications and no discounts; cards and their holders stay as they are. */
  enabled: boolean;
  /** Delivered orders a customer needs before they can apply. */
  ordersRequired: number;
  /** Every order of a card holder gets a random discount from `percentMin` to `percentMax` percent. */
  percentMin: number;
  percentMax: number;
  /** The most one checkout can be reduced by (PKR); 0 = no limit. */
  maxDiscount: number;
};

export const DEFAULT_CARD_SETTINGS: LoyaltyCardSettingsValues = {
  enabled: true,
  ordersRequired: 20,
  percentMin: 1,
  percentMax: 10,
  maxDiscount: 0,
};

/** The largest values an admin can save (a typing slip like 100000 orders is refused). */
export const CARD_LIMITS = {
  ordersRequired: 1000,
  percentMax: 100,
  maxDiscount: 1_000_000,
} as const;

export const MAX_CARD_REASON_LENGTH = 200;

/** The number on the card, e.g. MW-LC10001. */
export function cardRef(cardNumber: number) {
  return `MW-LC${cardNumber}`;
}

type SettingsInput = Partial<Record<keyof LoyaltyCardSettingsValues, unknown>> | null | undefined;

const toWhole = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);

/** What an admin sent as the rules: checked, with a message for the first problem. */
export function parseCardSettings(input: SettingsInput): { settings: LoyaltyCardSettingsValues } | { error: string } {
  const ordersRequired = toWhole(input?.ordersRequired);
  const percentMin = toWhole(input?.percentMin);
  const percentMax = toWhole(input?.percentMax);
  const maxDiscount = toWhole(input?.maxDiscount);

  if (typeof input?.enabled !== 'boolean') return { error: 'Choose whether the Loyalty Card is on or off.' };

  if (!Number.isInteger(ordersRequired) || ordersRequired < 1 || ordersRequired > CARD_LIMITS.ordersRequired) {
    return { error: `Orders needed to apply must be a whole number from 1 to ${CARD_LIMITS.ordersRequired.toLocaleString('en-PK')}.` };
  }

  if (!Number.isInteger(percentMin) || !Number.isInteger(percentMax) || percentMin < 1 || percentMax < percentMin || percentMax > CARD_LIMITS.percentMax) {
    return { error: `The discount must be whole percents from 1 up to ${CARD_LIMITS.percentMax}, and the highest can't be below the lowest.` };
  }

  if (!Number.isInteger(maxDiscount) || maxDiscount < 0 || maxDiscount > CARD_LIMITS.maxDiscount) {
    return { error: `The most one order can be reduced by must be a whole number of rupees from 0 (no limit) to ${CARD_LIMITS.maxDiscount.toLocaleString('en-PK')}.` };
  }

  return { settings: { enabled: input.enabled, ordersRequired, percentMin, percentMax, maxDiscount } };
}

/**
 * How much a card's discount takes off each order of one checkout. `bases` is what each order's items still cost (after any
 * coupon); the discount is `percent` of their total, at most `maxDiscount` (0 = no limit), in whole PKR, shared out between
 * the orders in proportion to their items and never more than an order's items cost. Returns one amount per order; all
 * zeros when the whole discount would be under Rs 1 (then nothing is used up).
 */
export function allocateLoyaltyDiscount(percent: number, maxDiscount: number, bases: number[]) {
  const total = bases.reduce((sum, base) => sum + Math.max(0, base), 0);
  const none = bases.map(() => 0);

  if (total <= 0 || percent <= 0) return none;

  const cap = maxDiscount > 0 ? maxDiscount : Infinity;
  // The tiny allowance keeps floating point (e.g. 29.999999999999996) from losing a whole rupee.
  const whole = Math.floor(Math.min((total * percent) / 100 + 1e-9, cap));

  if (whole < 1) return none;

  const shares = bases.map((base) => Math.min(Math.floor(Math.max(0, base)), Math.floor((whole * Math.max(0, base)) / total)));
  let left = whole - shares.reduce((sum, share) => sum + share, 0);

  // The rupees lost to rounding go to the orders one at a time, never past what an order's items cost.
  for (let i = 0; left > 0 && i < bases.length * 2; i++) {
    const index = i % bases.length;

    if (shares[index] < Math.floor(Math.max(0, bases[index]))) {
      shares[index] += 1;
      left -= 1;
    }
  }

  return shares;
}
