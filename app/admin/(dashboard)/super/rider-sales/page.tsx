import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Bike, CircleDollarSign, HandCoins, PackageCheck, type LucideIcon } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { isSuperAdminLogin } from '@/lib/super-admin';
import { prisma } from '@/lib/prisma';
import { startOfKarachiDay } from '@/lib/admin-stats';
import { SUPER_RANGES } from '@/lib/super-admin-stats';

const DAY_MS = 24 * 60 * 60 * 1000;
type Range = 7 | 14 | 30 | 'all';

function parseRange(value: string | undefined): Range {
  if (value === 'all') return 'all';
  const days = Number(value);
  return SUPER_RANGES.includes(days as 7 | 14 | 30) ? days as 7 | 14 | 30 : 7;
}

const pkr = (value: number) => `PKR ${Math.round(value).toLocaleString('en-IN')}`;

export const metadata = { title: 'Rider Sales - Mangwaoo Admin' };

export default async function RiderSalesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/admin/login');

  const admin = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  if (!isSuperAdminLogin(admin?.email)) redirect('/admin');

  const range = parseRange((await searchParams).range);
  const since = range === 'all' ? undefined : new Date(startOfKarachiDay(new Date().getTime()) - (range - 1) * DAY_MS);
  const grouped = await prisma.riderOrderRecord.groupBy({
    by: ['riderId'],
    where: { status: 'DELIVERED', ...(since ? { endedAt: { gte: since } } : {}) },
    _sum: { deliveryCharge: true, commission: true },
    _count: { _all: true },
  });
  const riders = await prisma.rider.findMany({
    where: { id: { in: grouped.map((row) => row.riderId) } },
    select: { id: true, user: { select: { name: true } } },
  });
  const nameById = new Map(riders.map((rider) => [rider.id, rider.user.name]));
  const rows = grouped.map((row) => {
    const deliveryCharges = row._sum.deliveryCharge ?? 0;
    const commission = row._sum.commission ?? 0;
    return {
      riderId: row.riderId,
      name: nameById.get(row.riderId) ?? 'Rider account removed',
      deliveries: row._count._all,
      deliveryCharges,
      commission,
      commissionPercent: deliveryCharges > 0 ? (commission / deliveryCharges) * 100 : 0,
      riderShare: deliveryCharges - commission,
    };
  }).sort((a, b) => b.deliveryCharges - a.deliveryCharges || a.name.localeCompare(b.name));

  const totals = rows.reduce((sum, row) => ({
    deliveries: sum.deliveries + row.deliveries,
    deliveryCharges: sum.deliveryCharges + row.deliveryCharges,
    commission: sum.commission + row.commission,
    riderShare: sum.riderShare + row.riderShare,
  }), { deliveries: 0, deliveryCharges: 0, commission: 0, riderShare: 0 });
  const totalCommissionPercent = totals.deliveryCharges > 0 ? (totals.commission / totals.deliveryCharges) * 100 : 0;
  const rangeLabel = range === 'all' ? 'All time' : `Last ${range} days`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/admin/super" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" /> Super Overview
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Rider Sales</h1>
          <p className="mt-1 text-sm text-brand-gray">Completed deliveries: delivery charges handled and Mangwaoo&apos;s commission.</p>
        </div>
        <nav aria-label="Sales date range" className="flex flex-wrap gap-2">
          {(['all', ...SUPER_RANGES] as Range[]).map((value) => (
            <Link key={value} href={`/admin/super/rider-sales?range=${value}`} aria-current={value === range ? 'page' : undefined}
              className={`rounded-full px-3 py-2 text-xs font-semibold ${value === range ? 'bg-brand-dark text-white' : 'bg-surface text-brand-gray shadow-soft hover:text-ink'}`}>
              {value === 'all' ? 'All time' : `${value} days`}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mb-4 text-sm font-semibold text-brand-gray">{rangeLabel}</p>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary icon={Bike} label="Completed deliveries" value={totals.deliveries.toLocaleString('en-IN')} />
        <Summary icon={CircleDollarSign} label="Delivery charges handled" value={pkr(totals.deliveryCharges)} />
        <Summary icon={HandCoins} label={`Mangwaoo commission · ${totalCommissionPercent.toFixed(1)}% effective`} value={pkr(totals.commission)} />
      </div>

      <section className="overflow-hidden rounded-2xl bg-surface shadow-soft">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-bold text-ink">Sales by rider</h2>
          <p className="mt-1 text-xs text-brand-gray">Commission percentage is the actual weighted average from completed orders; it reflects any past rule changes.</p>
        </div>
        {rows.length === 0 ? <p className="px-5 py-10 text-center text-sm text-brand-gray">No completed rider deliveries in this period.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-brand-light text-xs uppercase tracking-wide text-brand-gray">
                <tr><th className="px-5 py-3">Rider</th><th className="px-5 py-3 text-right">Deliveries</th><th className="px-5 py-3 text-right">Delivery charges</th><th className="px-5 py-3 text-right">Mangwaoo cut</th><th className="px-5 py-3 text-right">Rider share*</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => <tr key={row.riderId}>
                  <th scope="row" className="px-5 py-4 font-semibold text-ink">{row.name}<span className="mt-0.5 block text-xs font-normal text-brand-gray">{row.commissionPercent.toFixed(1)}% commission</span></th>
                  <td className="px-5 py-4 text-right text-ink">{row.deliveries.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4 text-right text-ink">{pkr(row.deliveryCharges)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-accent">{pkr(row.commission)}<span className="ml-1 text-xs font-normal text-brand-gray">({row.commissionPercent.toFixed(1)}%)</span></td>
                  <td className="px-5 py-4 text-right text-ink">{pkr(row.riderShare)}</td>
                </tr>)}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-brand-light font-bold text-ink">
                <tr><th className="px-5 py-4">Total</th><td className="px-5 py-4 text-right">{totals.deliveries.toLocaleString('en-IN')}</td><td className="px-5 py-4 text-right">{pkr(totals.deliveryCharges)}</td><td className="px-5 py-4 text-right">{pkr(totals.commission)} ({totalCommissionPercent.toFixed(1)}%)</td><td className="px-5 py-4 text-right">{pkr(totals.riderShare)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-brand-gray">* Rider share is delivery charges after commission, before any delivery bonus. Food/cart order totals are recorded separately from rider delivery charges.</p>
      </section>
      <p className="mt-4 flex items-center gap-2 text-xs text-brand-gray"><PackageCheck className="h-4 w-4" /> Only completed deliveries are counted; cancelled or unassigned chats are excluded.</p>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-2xl bg-surface p-5 shadow-soft"><div className="flex items-center gap-2 text-xs font-semibold text-brand-gray"><Icon className="h-4 w-4 text-accent" />{label}</div><p className="mt-2 text-2xl font-bold text-ink">{value}</p></div>;
}
