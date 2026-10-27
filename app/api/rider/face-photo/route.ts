import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimits } from '@/lib/rate-limit';
import { RIDER_DOCUMENT_FIELDS } from '@/lib/rider-documents';
import { readRiderPhoto } from '@/lib/rider-photo-upload';

/**
 * A rider who signed up before the face photo was required adds it here (from the dashboard), so their application can
 * be approved. It can only be added, never swapped: once a face photo is on file it stays, so nobody else's face can
 * replace the one the admin checked (to change it, the rider asks Mangwaoo Support). Riders only.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'RIDER') {
    return NextResponse.json({ error: 'Please log in as a rider to do this.' }, { status: 401 });
  }

  const rider = await prisma.rider.findUnique({
    where: { userId: session.userId },
    select: { id: true, documents: { where: { kind: 'FACE' }, select: { id: true } } },
  });

  if (!rider) {
    return NextResponse.json({ error: 'Rider account not found.' }, { status: 404 });
  }

  if (rider.documents.length > 0) {
    return NextResponse.json({ error: 'Your face photo is already on file. To change it, please contact Mangwaoo Support.' }, { status: 409 });
  }

  const limited = await enforceRateLimits([{ scope: 'rider-face-photo', subject: rider.id, limit: 10, windowSeconds: 3600 }]);
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const read = await readRiderPhoto('FACE', form?.get(RIDER_DOCUMENT_FIELDS.FACE) ?? null);

  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: 400 });
  }

  try {
    await prisma.riderDocument.create({ data: { riderId: rider.id, ...read.photo } });
  } catch {
    // Two uploads at once: the other one won.
    return NextResponse.json({ error: 'Your face photo is already on file. To change it, please contact Mangwaoo Support.' }, { status: 409 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
