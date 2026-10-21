import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSellerNotifications } from '@/lib/seller-notifications';
import AdminShell from '@/components/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/login?next=/admin');
  }

  const [admin, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
    getSellerNotifications(session.userId),
  ]);

  return (
    <AdminShell adminName={admin?.name ?? 'Admin'} initialNotifications={notifications}>
      {children}
    </AdminShell>
  );
}
