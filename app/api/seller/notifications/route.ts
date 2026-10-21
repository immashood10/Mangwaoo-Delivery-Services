import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSellerNotifications } from '@/lib/seller-notifications';

// The seller's unread notifications; the dashboard polls this.
export async function GET() {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    return NextResponse.json({ error: 'You must be logged in as a seller to do this.' }, { status: 401 });
  }

  return NextResponse.json(await getSellerNotifications(session.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
