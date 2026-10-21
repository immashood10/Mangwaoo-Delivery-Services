import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { RIDER_DOCUMENT_KINDS, type RiderDocumentKind } from '@/lib/rider-documents';

/** Serves a rider's CNIC photo from the database. Admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id, kind } = await params;

  if (!(RIDER_DOCUMENT_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: 'Unknown document.' }, { status: 404 });
  }

  const document = await prisma.riderDocument.findUnique({
    where: { riderId_kind: { riderId: id, kind: kind as RiderDocumentKind } },
  });

  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  return new Response(Buffer.from(document.data), {
    headers: {
      'Content-Type': document.mimeType,
      'Content-Length': String(document.size),
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      // Identity documents: never cache on shared or disk caches.
      'Cache-Control': 'private, no-store',
    },
  });
}
