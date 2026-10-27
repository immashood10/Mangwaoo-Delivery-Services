'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar, { adminPageTitle } from '@/components/AdminSidebar';
import { NotificationBell, SellerNotificationsProvider } from '@/components/seller/SellerNotifications';
import type { NotificationSnapshot } from '@/lib/notification-types';

const ADMIN_NOTIFICATIONS_API = '/api/admin/notifications';

/**
 * The admin panel frame: sidebar on the left, and on the right a top bar with the notification bell
 * (new signups, orders, order chats and ad requests) above the page.
 */
export default function AdminShell({
  adminName,
  isSuperAdmin = false,
  initialNotifications,
  children,
}: {
  adminName: string;
  /** The "superadmin" account also gets the Super Overview link. */
  isSuperAdmin?: boolean;
  initialNotifications: NotificationSnapshot;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SellerNotificationsProvider initial={initialNotifications} endpoint={ADMIN_NOTIFICATIONS_API}>
      <div className="flex min-h-screen flex-col bg-gray-50 lg:flex-row">
        <AdminSidebar adminName={adminName} isSuperAdmin={isSuperAdmin} />
        <div className="min-w-0 flex-1">
          {/* Desktop: page title on the left, notifications on the right (on a phone the bell is in the top bar) */}
          <header className="sticky top-0 z-30 hidden items-center justify-between gap-4 border-b border-gray-100 bg-surface px-8 py-3 lg:flex">
            <p className="text-sm font-semibold text-brand-gray">{adminPageTitle(pathname)}</p>
            <NotificationBell />
          </header>
          {children}
        </div>
      </div>
    </SellerNotificationsProvider>
  );
}
