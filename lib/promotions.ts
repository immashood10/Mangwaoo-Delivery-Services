import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { CARD_COLUMNS, toAdCards, type AdRow } from '@/lib/ads';
import { adState, type AdPlacementKey, type AdState, type AdStatusKey } from '@/lib/ad-config';

// "now" for ad windows is taken inside the database, in UTC, so it lines up with the timestamps Prisma stores.
const DB_NOW = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

/**
 * Ads that are running right now for a placement, in random order so every advertiser gets a turn.
 * Ads whose product was removed or sold out are skipped for as long as that stays true.
 */
export async function getRunningAds(placement: AdPlacementKey, limit: number, categoryName?: string | null) {
  // Ads are an extra: if looking them up fails, the page still shows everything else.
  try {
    return await queryRunningAds(placement, limit, categoryName);
  } catch (error) {
    console.error('Could not load running ads:', error);
    return [];
  }
}

async function queryRunningAds(placement: AdPlacementKey, limit: number, categoryName?: string | null) {
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT ${CARD_COLUMNS}
    FROM "ProductAd" a
    JOIN "Product" p ON p."id" = a."productId"
    JOIN "Category" c ON c."id" = p."categoryId"
    JOIN "Seller" s ON s."id" = p."sellerId"
    WHERE a."status" = 'ACTIVE'
      AND a."placement" = ${placement}::"AdPlacement"
      AND a."startsAt" <= ${DB_NOW}
      AND a."endsAt" > ${DB_NOW}
      AND p."isActive" = true
      AND p."stock" > 0
      ${categoryName ? Prisma.sql`AND c."name" = ${categoryName}` : Prisma.empty}
    ORDER BY random()
    LIMIT ${limit}`;

  return toAdCards(rows);
}

export type AdRequestRow = {
  id: string;
  placement: AdPlacementKey;
  status: AdStatusKey;
  state: AdState;
  amount: number;
  paymentRef: string;
  rejectionReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Whole days an active ad has left, at least 1 (0 when it isn't running). */
  daysLeft: number;
  createdAt: string;
  productId: string;
  productName: string;
  /** How many people watched a Story ad's story; null for the other kinds of ad. */
  storyViews: number | null;
  /** Admin view only. */
  storeName?: string;
  ownerEmail?: string;
};

type AdWithProduct = Prisma.ProductAdGetPayload<{
  include: { product: { select: { name: true } }; story: { select: { _count: { select: { views: true } } } } };
}>;

// Ad rows come with the product name and, for a Story ad, how many people watched its story.
const AD_ROW_INCLUDE = {
  product: { select: { name: true } },
  story: { select: { _count: { select: { views: true } } } },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function toRow(ad: AdWithProduct, now: number): AdRequestRow {
  const state = adState(ad, now);

  return {
    id: ad.id,
    placement: ad.placement,
    status: ad.status,
    state,
    amount: ad.amount,
    paymentRef: ad.paymentRef,
    rejectionReason: ad.rejectionReason,
    startsAt: ad.startsAt?.toISOString() ?? null,
    endsAt: ad.endsAt?.toISOString() ?? null,
    daysLeft: state === 'LIVE' && ad.endsAt ? Math.max(1, Math.ceil((ad.endsAt.getTime() - now) / DAY_MS)) : 0,
    createdAt: ad.createdAt.toISOString(),
    productId: ad.productId,
    productName: ad.product.name,
    storyViews: ad.placement === 'STORY' ? (ad.story?._count.views ?? 0) : null,
  };
}

/** A seller's ad requests, newest first. */
export async function getSellerAdRequests(sellerId: string): Promise<AdRequestRow[]> {
  const ads = await prisma.productAd.findMany({
    where: { sellerId },
    orderBy: { createdAt: 'desc' },
    include: AD_ROW_INCLUDE,
  });
  const now = Date.now();

  return ads.map((ad) => toRow(ad, now));
}

/** Every ad request for the admin review page (except ones the admin deleted), with who asked for it. */
export async function getAllAdRequests(): Promise<AdRequestRow[]> {
  const ads = await prisma.productAd.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      ...AD_ROW_INCLUDE,
      seller: { select: { businessName: true, user: { select: { email: true } } } },
    },
  });
  const now = Date.now();

  return ads.map((ad) => ({
    ...toRow(ad, now),
    storeName: ad.seller.businessName,
    ownerEmail: ad.seller.user.email,
  }));
}
