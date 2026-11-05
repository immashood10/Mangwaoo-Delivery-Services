import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminLogin } from '@/lib/super-admin';
import AdminSellerApprovals from '@/components/AdminSellerApprovals';

export const metadata = { title: 'MangwaooMart Seller Approvals - Mangwaoo Admin' };

export default async function MartSellerApprovalsPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') redirect('/admin/login');

  const admin = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  if (!isSuperAdminLogin(admin?.email)) redirect('/admin');

  const sellers = await prisma.seller.findMany({
    where: {
      sellerType: 'MART',
      isOfficial: false,
      user: { phoneVerifiedAt: { not: null }, deletedAt: null },
    },
    orderBy: [{ isApproved: 'asc' }, { createdAt: 'desc' }],
    include: { user: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <ShieldCheck className="h-4 w-4" />
        Super admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">MangwaooMart Seller Approvals</h1>
      <p className="mb-8 text-brand-gray">
        Review vendor applications. Approved sellers can list products for customers to order. For food businesses, use{' '}
        <Link href="/admin/sellers" className="font-semibold text-accent hover:underline">Food Seller Approvals</Link>.
      </p>
      <div className="rounded-2xl bg-surface p-6 shadow-soft">
        <AdminSellerApprovals
          marketplace="mart"
          sellers={sellers.map((seller) => ({
            id: seller.id,
            businessName: seller.businessName,
            ownerName: seller.user.name,
            email: seller.user.email,
            sellerType: seller.sellerType,
            isApproved: seller.isApproved,
            hasLocation: seller.latitude !== null && seller.longitude !== null,
            createdAt: seller.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
