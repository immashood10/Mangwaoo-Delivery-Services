import { redirect } from 'next/navigation';
import { Bike } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import RiderDashboard from '@/components/RiderDashboard';

export const metadata = { title: 'Rider Dashboard - Mangwaoo' };

export default async function RiderDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'RIDER') redirect('/login?next=/rider');

  const rider = await prisma.rider.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true } } },
  });
  if (!rider) redirect('/login');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Bike className="h-4 w-4" /> Rider
      </div>
      <h1 className="mb-6 text-3xl font-bold text-ink">Welcome, {rider.user.name.split(' ')[0]}</h1>
      <RiderDashboard rider={{ name: rider.user.name, isApproved: rider.isApproved, isAvailable: rider.isAvailable, vehicleType: rider.vehicleType }} />
    </div>
  );
}
