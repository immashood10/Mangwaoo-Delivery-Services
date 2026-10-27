import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Marks a customer's complaint about a rider as looked into (or open again). Admin only. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'You must be logged in as an admin to do this.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const resolved = typeof body?.resolved === 'boolean' ? body.resolved : true;

  const updated = await prisma.riderOrderRecord.updateMany({
    where: { id, complaint: { not: null } },
    data: { complaintResolvedAt: resolved ? new Date() : null },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, resolved });
}
