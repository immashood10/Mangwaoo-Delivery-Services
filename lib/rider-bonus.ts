import { randomInt } from 'node:crypto';
import type { Prisma } from '@/lib/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_BONUS_SETTINGS,
  bonusRangeFor,
  bonusTierFor,
  type BonusTier,
  type RiderBonusSettingsValues,
} from '@/lib/rider-bonus-config';

// The rider's delivery bonus (the rules are in lib/rider-bonus-config.ts). The wallet line itself is written by
// `closeOrderChat` (lib/rider-wallet.ts), in the transaction that finishes the order, so it exists exactly once per order.

type Db = Prisma.TransactionClient | typeof prisma;

export async function getBonusSettings(client: Db = prisma): Promise<RiderBonusSettingsValues> {
  const row = await client.riderBonusSettings.findUnique({ where: { id: 'default' } });

  if (!row) return DEFAULT_BONUS_SETTINGS;

  return {
    enabled: row.enabled,
    nearMaxKm: row.nearMaxKm,
    midMaxKm: row.midMaxKm,
    nearMin: row.nearMin,
    nearMax: row.nearMax,
    midMin: row.midMin,
    midMax: row.midMax,
    farMin: row.farMin,
    farMax: row.farMax,
  };
}

export async function saveBonusSettings(settings: RiderBonusSettingsValues) {
  await prisma.riderBonusSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...settings }, update: settings });
}

/**
 * The random bonus for an order `distanceKm` away (null = not known, which counts as the first tier): a whole number of rupees
 * from the secure random source, between the lowest and the highest of the tier the distance falls in, both included.
 */
export function drawBonus(distanceKm: number | null, settings: RiderBonusSettingsValues): { amount: number; tier: BonusTier } {
  const tier = bonusTierFor(distanceKm, settings);
  const { min, max } = bonusRangeFor(tier, settings);

  return { amount: randomInt(min, max + 1), tier };
}
