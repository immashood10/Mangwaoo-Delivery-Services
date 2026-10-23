import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import RiderShell from '@/components/rider/RiderShell';

export const metadata: Metadata = {
  title: 'Rider dashboard - Mangwaoo',
};

// The rider's pages (everything under /rider except the public /rider/signup) share this frame: left sidebar,
// notification bell and the rider's live state (online / location / requests), which survives moving between pages.
export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'RIDER') redirect('/login?next=/rider');

  const rider = await prisma.rider.findUnique({
    where: { userId: session.userId },
    include: { user: { select: { name: true } } },
  });

  if (!rider) redirect('/login');

  return (
    <RiderShell
      rider={{ name: rider.user.name, isApproved: rider.isApproved, isAvailable: rider.isAvailable, vehicleType: rider.vehicleType }}
    >
      {children}
    </RiderShell>
  );
}
