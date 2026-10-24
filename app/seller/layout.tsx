import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getCurrentSeller, isFoodSeller } from '@/lib/seller-context';
import { getSellerNotifications } from '@/lib/seller-notifications';
import SellerShell from '@/components/seller/SellerShell';

export const metadata: Metadata = {
  title: 'Seller dashboard - Mangwaoo',
};

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    redirect('/sell');
  }

  // Both only need the session, so they run together (the database is a round trip away).
  const [seller, notifications] = await Promise.all([getCurrentSeller(), getSellerNotifications(session.userId)]);

  if (!seller) {
    redirect('/sell');
  }

  return (
    <SellerShell
      profile={{
        storeName: seller.businessName,
        ownerName: seller.user.name,
        isApproved: seller.isApproved,
        isFood: isFoodSeller(seller),
        // Customers only see food restaurants within 5 km of them, which needs the kitchen on the map.
        hasLocation: seller.latitude !== null && seller.longitude !== null,
        dashboardLabel: isFoodSeller(seller) ? 'Food seller dashboard' : 'Seller dashboard',
      }}
      initialNotifications={notifications}
    >
      {children}
    </SellerShell>
  );
}
