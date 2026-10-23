'use client';

import { NotificationBell, SellerNotificationsProvider } from '@/components/seller/SellerNotifications';

const EMPTY = { items: [], counts: {} };
// Customers and riders aren't in a dashboard all day, so the bell checks a little less often than the seller's.
const POLL_MS = 30000;

/**
 * The notification bell for customers and riders (the public navbar and the rider dashboard; for example a message an
 * admin sent from Mangwaoo). It is the seller's bell pointed at `/api/notifications`; the provider also pops a toast
 * for each new one.
 */
export default function UserNotificationBell({ onDark = false }: { onDark?: boolean }) {
  return (
    <SellerNotificationsProvider initial={EMPTY} endpoint="/api/notifications" pollMs={POLL_MS} fetchOnMount>
      <NotificationBell onDark={onDark} />
    </SellerNotificationsProvider>
  );
}
