import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { areaCentre, findManager, listAssignableRiders } from '@/lib/area-managers';
import { getMonthlyRiderAdminPage } from '@/lib/monthly-rider';
import MonthlyRiderManage from '@/components/MonthlyRiderManage';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Monthly riders - Mangwaoo',
};

export default async function AsmMonthlyRidersPage() {
  const session = await getSession();

  if (!session || session.role !== 'ASM') redirect('/login?next=/asm/monthly-riders');

  const manager = await findManager(session.userId);

  if (!manager) redirect('/login');

  const [data, riders] = await Promise.all([getMonthlyRiderAdminPage(manager.areaId), listAssignableRiders(areaCentre(manager.areaId))]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AutoRefresh intervalMs={15000} />
      <h1 className="mb-1 text-2xl font-bold text-ink">Monthly riders · {manager.areaName}</h1>
      <p className="mb-6 text-sm text-brand-gray">
        Customers of your area who want a rider of their own for a month. Set the price and choose the rider; Mangwaoo&apos;s admins check the
        payment and start the month.
      </p>

      <MonthlyRiderManage data={data} riders={riders} mode="asm" />
    </div>
  );
}
