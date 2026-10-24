// A food seller's background ("cover") picture: shown behind the restaurant's page header and on its card. It is
// stored as bytes in its own table (`SellerCover`), and `Seller.coverUpdatedAt` says when it was last set.
// Values shared by the forms (browser) and the routes (server); the server-only checks are in `seller-cover.ts`.

/** The biggest picture accepted. The browser shrinks it first (1600 px, JPEG), so a real one is a few hundred KB. */
export const MAX_COVER_BYTES = 2 * 1024 * 1024;

/** The longest side the form shrinks the picture to before sending it. */
export const COVER_MAX_DIMENSION = 1600;

/**
 * Where a restaurant's background picture is served from. The version (when the picture was set) is part of the
 * address, so a new picture is fetched at once instead of the old one the browser kept.
 */
export function coverPath(sellerId: string, coverUpdatedAt: Date | string | number): string {
  return `/api/restaurants/${sellerId}/cover?v=${new Date(coverUpdatedAt).getTime()}`;
}
