import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSellerNotifications } from '@/lib/seller-notifications';

// The admin's unread notifications (new signups, orders, order chats, ad requests); the admin panel polls this.
export async function GET() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 });
  }

  return NextResponse.json(await getSellerNotifications(session.userId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
