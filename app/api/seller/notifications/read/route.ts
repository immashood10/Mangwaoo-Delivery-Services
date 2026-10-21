import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { markNotificationsSeen } from '@/lib/seller-notifications';

// Marks notifications as seen — by id, by the dashboard page they belong to, or all of them.
// Seen notifications stop showing; what they were about stays in its own page.
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  const snapshot = await markNotificationsSeen(session.userId, await request.json().catch(() => null));

  if (!snapshot) {
    return NextResponse.json({ error: 'Nothing to mark as seen.' }, { status: 400 });
  }

  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
