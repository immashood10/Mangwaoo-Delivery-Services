import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findContactableUser, getSupportThreadSummaries } from '@/lib/support';

async function requireAdmin() {
  const session = await getSession();
  return session?.role === 'ADMIN' ? session : null;
}

// Every seller/rider the admin has a thread with, newest first (the Messages page polls this).
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  return NextResponse.json({ threads: await getSupportThreadSummaries() }, { headers: { 'Cache-Control': 'no-store' } });
}

// Opens (or finds) the thread with one seller or rider so the admin can write to them.
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';

  if (!userId) {
    return NextResponse.json({ error: 'Choose a seller or rider.' }, { status: 400 });
  }

  const user = await findContactableUser(userId);

  if (!user) {
    return NextResponse.json({ error: 'Only sellers and riders can be messaged.' }, { status: 404 });
  }

  await prisma.supportThread.upsert({ where: { userId }, create: { userId }, update: {} });
  const [thread] = await getSupportThreadSummaries(userId);

  return NextResponse.json({ thread }, { status: 201 });
}
