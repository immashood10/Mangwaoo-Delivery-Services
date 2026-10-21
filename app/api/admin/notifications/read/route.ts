import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markNotificationsSeen } from '@/lib/seller-notifications';

// Marks admin notifications as seen — by id, by the admin page they belong to, or all of them.
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  const snapshot = await markNotificationsSeen(session.userId, await request.json().catch(() => null));

  if (!snapshot) {
    return NextResponse.json({ error: 'Nothing to mark as seen.' }, { status: 400 });
  }

  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
