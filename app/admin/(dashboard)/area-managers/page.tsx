import { redirect } from 'next/navigation';
import { UserCog } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listManagers } from '@/lib/area-managers';
import { isSuperAdminLogin } from '@/lib/super-admin';
import AdminAreaManagers from '@/components/AdminAreaManagers';

export const metadata = {
  title: 'Area Managers - Mangwaoo Admin',
};

export default async function AdminAreaManagersPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });

  // Only the super admin makes and removes managers; any other admin is sent back to the normal dashboard.
  if (!isSuperAdminLogin(me?.email)) {
    redirect('/admin');
  }

  const managers = await listManagers();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <UserCog className="h-4 w-4" />
        Super admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Area Managers</h1>
      <p className="mb-8 max-w-3xl text-brand-gray">
        An Area Sales Manager (ASM) looks after one area. When a customer sends an order with the Chat button, it goes to the manager
        of the customer&apos;s area, who picks the rider and assigns the order. Orders from the cart are different: the first rider to
        accept gets them. A rider who has to pay Mangwaoo first cannot be given an order.
      </p>

      <AdminAreaManagers initialManagers={managers} />
    </div>
  );
}
