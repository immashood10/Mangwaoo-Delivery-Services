// The rider's delivery bonus: the rules shared by the API routes, the rider dashboard and the admin page (client-safe, no database).
//
// How it works: a rider who completes an order gets a random bonus (whole PKR) that depends on how far the order was, judged to
// 0.1 km like the delivery fee: up to 3 km Rs 1 to 20, from 3 to 5 km Rs 1 to 50, beyond 5 km Rs 50 to 100 (to start with). It is a
// BONUS line in the rider's wallet: positive money, so it is set off against the commission the rider owes. An order whose
// distance isn't known (MangwaooMart only, an older chat) counts as the first tier. An admin can change every number or switch
// the bonus off.

import { billedDistanceKm } from '@/lib/delivery';

export type BonusTier = 'NEAR' | 'MID' | 'FAR';

export type RiderBonusSettingsValues = {
  /** Off = no new bonuses; the ones already paid stay. */
  enabled: boolean;
  /** Orders up to this many km get the first tier's bonus, up to `midMaxKm` the second's, beyond it the third's. */
  nearMaxKm: number;
  midMaxKm: number;
  nearMin: number;
  nearMax: number;
  midMin: number;
  midMax: number;
  farMin: number;
  farMax: number;
};

export const DEFAULT_BONUS_SETTINGS: RiderBonusSettingsValues = {
  enabled: true,
  nearMaxKm: 3,
  midMaxKm: 5,
  nearMin: 1,
  nearMax: 20,
  midMin: 1,
  midMax: 50,
  farMin: 50,
  farMax: 100,
};

/** The largest values an admin can save (a typing slip like 100000 km is refused). */
export const BONUS_LIMITS = { km: 1000, amount: 100000 } as const;

/** Which tier a ride of `distanceKm` (null = not known) falls in: up to `nearMaxKm` the first, up to `midMaxKm` the second, beyond it the third. */
export function bonusTierFor(distanceKm: number | null, settings: Pick<RiderBonusSettingsValues, 'nearMaxKm' | 'midMaxKm'>): BonusTier {
  if (distanceKm === null) return 'NEAR';

  const billed = billedDistanceKm(distanceKm);

  if (billed <= settings.nearMaxKm) return 'NEAR';

  return billed <= settings.midMaxKm ? 'MID' : 'FAR';
}

/** The lowest and highest bonus of a tier. */
export function bonusRangeFor(tier: BonusTier, settings: RiderBonusSettingsValues) {
  if (tier === 'NEAR') return { min: settings.nearMin, max: settings.nearMax };
  if (tier === 'MID') return { min: settings.midMin, max: settings.midMax };

  return { min: settings.farMin, max: settings.farMax };
}

type SettingsInput = Partial<Record<keyof RiderBonusSettingsValues, unknown>> | null | undefined;

const toNumber = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);

function amountsProblem(label: string, min: number, max: number) {
  if (Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max >= min && max <= BONUS_LIMITS.amount) return null;

  return `The ${label} bonus must be whole rupees from 1 up to ${BONUS_LIMITS.amount.toLocaleString('en-PK')}, and the highest can't be below the lowest.`;
}

/** What an admin sent as the rules: checked, with a message for the first problem. */
export function parseBonusSettings(input: SettingsInput): { settings: RiderBonusSettingsValues } | { error: string } {
  if (typeof input?.enabled !== 'boolean') return { error: 'Choose whether the delivery bonus is on or off.' };

  // Distances are judged to 0.1 km, like the delivery fee.
  const nearMaxKm = Math.round(toNumber(input.nearMaxKm) * 10) / 10;
  const midMaxKm = Math.round(toNumber(input.midMaxKm) * 10) / 10;
  const nearMin = toNumber(input.nearMin);
  const nearMax = toNumber(input.nearMax);
  const midMin = toNumber(input.midMin);
  const midMax = toNumber(input.midMax);
  const farMin = toNumber(input.farMin);
  const farMax = toNumber(input.farMax);

  if (!Number.isFinite(nearMaxKm) || !Number.isFinite(midMaxKm) || nearMaxKm <= 0 || midMaxKm <= nearMaxKm || midMaxKm > BONUS_LIMITS.km) {
    return { error: `The distances must be in km: the first above 0, the second above the first, and at most ${BONUS_LIMITS.km}.` };
  }

  const problem = amountsProblem('closest-orders', nearMin, nearMax) ?? amountsProblem('middle-distance', midMin, midMax) ?? amountsProblem('farthest-orders', farMin, farMax);

  if (problem) return { error: problem };

  return { settings: { enabled: input.enabled, nearMaxKm, midMaxKm, nearMin, nearMax, midMin, midMax, farMin, farMax } };
}
