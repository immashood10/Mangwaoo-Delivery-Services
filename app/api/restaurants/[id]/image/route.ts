import { prisma } from '@/lib/prisma';
import { dataUrlImageResponse } from '@/lib/data-url-image';

// A restaurant's picture on its card: the first photo of its newest listed dish that has one,
// the same photo its page uses as the banner. Cards load it from here instead of carrying the
// photo (a data URL) inside the page, and the browser caches it.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rows = await prisma.$queryRaw<{ image: string | null }[]>`
    SELECT p."images"[1] AS "image"
    FROM "GulplazaProduct" p
    JOIN "Seller" s ON s."id" = p."sellerId"
    WHERE s."id" = ${id}
      AND s."isApproved" = true AND s."sellerType" IN ('GULPLAZA_OWNER', 'WHOLESALER')
      AND p."isActive" = true AND cardinality(p."images") > 0
    ORDER BY p."createdAt" DESC
    LIMIT 1`;

  return dataUrlImageResponse(rows[0]?.image);
}
