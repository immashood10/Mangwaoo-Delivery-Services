import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markNotificationsSeen } from '@/lib/seller-notifications';

// Marks the signed-in person's notifications as seen — by id or all of them.
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }

  const snapshot = await markNotificationsSeen(session.userId, await request.json().catch(() => null));

  if (!snapshot) {
    return NextResponse.json({ error: 'Nothing to mark as seen.' }, { status: 400 });
  }

  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
