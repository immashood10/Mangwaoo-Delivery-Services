import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** The screenshot a rider attached to a recharge request, from the database. Admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const screenshot = await prisma.riderTopUpScreenshot.findUnique({ where: { topUpId: id } });

  if (!screenshot) {
    return NextResponse.json({ error: 'No screenshot was attached to this request.' }, { status: 404 });
  }

  return new Response(Buffer.from(screenshot.data), {
    headers: {
      'Content-Type': screenshot.mimeType,
      'Content-Length': String(screenshot.size),
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // A payment receipt: never kept on shared or disk caches.
      'Cache-Control': 'private, no-store',
    },
  });
}
