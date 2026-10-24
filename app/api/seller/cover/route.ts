import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { coverResponse, isVersioned } from '@/lib/seller-cover';

// The signed-in food seller's own background picture, for the preview in Settings. Unlike the public address it works
// before the seller is approved, and it is never kept by shared caches.

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  const cover = await prisma.sellerCover.findFirst({
    where: { seller: { userId: session.userId } },
    select: { mimeType: true, size: true, data: true },
  });

  if (!cover) {
    return new Response('Not found', { status: 404 });
  }

  return coverResponse(cover, { versioned: isVersioned(request.nextUrl.searchParams), shared: false });
}
