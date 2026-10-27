import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSellerNotifications } from '@/lib/seller-notifications';
import { isSuperAdminLogin } from '@/lib/super-admin';
import AdminShell from '@/components/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const [admin, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } }),
    getSellerNotifications(session.userId),
  ]);

  return (
    <AdminShell adminName={admin?.name ?? 'Admin'} isSuperAdmin={isSuperAdminLogin(admin?.email)} initialNotifications={notifications}>
      {children}
    </AdminShell>
  );
}
