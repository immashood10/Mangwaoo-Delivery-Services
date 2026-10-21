import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dataUrlImageResponse } from '@/lib/data-url-image';

// Ad photos are stored as data URLs. Cards in grids load them from here instead of
// carrying every photo inside the page, and the browser caches each one.

const MAX_PHOTOS = 6;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = Number.parseInt(request.nextUrl.searchParams.get('i') ?? '0', 10);
  const index = Number.isInteger(requested) ? Math.min(Math.max(requested, 0), MAX_PHOTOS - 1) : 0;

  const rows = await prisma.$queryRaw<{ image: string | null }[]>`
    SELECT "images"[${index + 1}::int] AS "image" FROM "Product" WHERE "id" = ${id} AND "isActive" = true`;

  return dataUrlImageResponse(rows[0]?.image);
}
