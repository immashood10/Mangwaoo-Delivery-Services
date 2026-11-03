import { redirect } from 'next/navigation';
import { Bike } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { listAssignableRiders } from '@/lib/area-managers';
import { getMonthlyRiderAdminPage } from '@/lib/monthly-rider';
import MonthlyRiderManage from '@/components/MonthlyRiderManage';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Monthly Riders - Mangwaoo Admin',
};

export default async function AdminMonthlyRidersPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const [data, riders] = await Promise.all([getMonthlyRiderAdminPage(), listAssignableRiders(null)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Bike className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Monthly Riders</h1>
      <p className="mb-8 max-w-3xl text-brand-gray">
        Customers can ask for a rider of their own for a month. Set the price and choose the rider (the area&apos;s manager can do this too). The
        customer pays Mangwaoo and enters the transaction ID: when the money has arrived, confirm it and the month starts. For 30 days the
        customer&apos;s orders go straight to that rider when they are online; otherwise they go the usual way.
      </p>

      <MonthlyRiderManage data={data} riders={riders} mode="admin" />
    </div>
  );
}
