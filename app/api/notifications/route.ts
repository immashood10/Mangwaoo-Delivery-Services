import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSellerNotifications } from '@/lib/seller-notifications';

// A customer's or rider's unread notifications (for example a message from Mangwaoo); the navbar bell polls this.
// Sellers and admins have their own bells (`/api/seller/notifications`, `/api/admin/notifications`).
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Please log in.' }, { status: 401 });
  }

  return NextResponse.json(await getSellerNotifications(session.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
