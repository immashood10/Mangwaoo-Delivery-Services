// Paid product ads: where they run, what they cost, and how long. Client-safe: shared by the
// seller's "Run an ad" page, the admin review page, the API and the site pages that show the ads.

export type AdPlacementKey = 'SIDEBAR' | 'MAIN_PAGE' | 'STORY';
export type AdStatusKey = 'PENDING' | 'ACTIVE' | 'REJECTED';
/** What an ad is doing right now: waiting for an admin, running, over, or turned down. */
export type AdState = 'PENDING' | 'LIVE' | 'ENDED' | 'REJECTED';

export const AD_PLACEMENTS: Record<
  AdPlacementKey,
  { label: string; description: string; where: string; priceRs: number; durationDays: number }
> = {
  SIDEBAR: {
    label: 'Right-side ad',
    description: 'Your product in the ad column on the right of MangwaooMart, marked Featured.',
    where: 'MangwaooMart, right column',
    priceRs: 500,
    durationDays: 7,
  },
  MAIN_PAGE: {
    label: 'Main page ad',
    description: 'Your product in the Featured row on the home page and at the top of MangwaooMart.',
    where: 'Home page and top of MangwaooMart',
    priceRs: 500,
    durationDays: 7,
  },
  STORY: {
    label: 'Story ad',
    description: 'Your product as a story on the Mangwaoo logo: everyone who taps the logo sees it, with a button to your product.',
    where: 'Story on the logo',
    priceRs: 300,
    durationDays: 1,
  },
};

export const AD_PLACEMENT_KEYS = Object.keys(AD_PLACEMENTS) as AdPlacementKey[];

export function isAdPlacement(value: unknown): value is AdPlacementKey {
  return typeof value === 'string' && Object.hasOwn(AD_PLACEMENTS, value);
}

/** "1 day" or "7 days". */
export function formatAdDays(days: number) {
  return days === 1 ? '1 day' : `${days} days`;
}

/** "the next day" or "the next 7 days", for sentences like "runs for the next 7 days". */
export function nextAdPeriod(days: number) {
  return days === 1 ? 'the next day' : `the next ${days} days`;
}

/**
 * Where money is sent to Mangwaoo: the sellers' ad fee and the riders' commission (Rider Wallet). There is no
 * online payment yet, so an admin checks the transaction id the person enters before the ad goes live / the
 * recharge is added. This is the owner's EasyPaisa account.
 */
export const AD_PAYMENT = {
  method: 'EasyPaisa',
  accountNumber: '03122855881',
  accountName: 'Muhammad Mashood Khan',
};

const MIN_PAYMENT_REF_LENGTH = 6;
const MAX_PAYMENT_REF_LENGTH = 40;

/** Cleans a transaction id (spaces dropped, upper case) or returns null when it can't be one. */
export function normalizePaymentRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const ref = value.replace(/\s+/g, '').toUpperCase();

  if (ref.length < MIN_PAYMENT_REF_LENGTH || ref.length > MAX_PAYMENT_REF_LENGTH) return null;

  return /^[A-Z0-9_\-/]+$/.test(ref) ? ref : null;
}

export function adState(
  ad: { status: AdStatusKey; startsAt: Date | string | null; endsAt: Date | string | null },
  now = Date.now()
): AdState {
  if (ad.status === 'REJECTED') return 'REJECTED';
  if (ad.status === 'PENDING') return 'PENDING';

  const starts = ad.startsAt ? new Date(ad.startsAt).getTime() : 0;
  const ends = ad.endsAt ? new Date(ad.endsAt).getTime() : 0;

  return starts <= now && now < ends ? 'LIVE' : 'ENDED';
}
