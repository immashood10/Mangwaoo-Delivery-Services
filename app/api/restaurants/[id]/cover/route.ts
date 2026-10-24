import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { coverResponse, isVersioned } from '@/lib/seller-cover';

// A restaurant's background picture (page header and card), from the database. Only approved food sellers' pictures
// are served here; a seller sees their own picture, approved or not, at /api/seller/cover.

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cover = await prisma.sellerCover.findFirst({
    where: { sellerId: id, seller: { isApproved: true, sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] } } },
    select: { mimeType: true, size: true, data: true },
  });

  if (!cover) {
    return new Response('Not found', { status: 404 });
  }

  return coverResponse(cover, { versioned: isVersioned(request.nextUrl.searchParams), shared: true });
}
