import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import AdminSellerApprovals from '@/components/AdminSellerApprovals';
import { ShieldCheck } from 'lucide-react';

export default async function AdminSellersPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/');
  }

  const sellers = await prisma.seller.findMany({
    where: { sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] } },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-brand-red-primary mb-3">
        <ShieldCheck className="w-4 h-4" />
        Admin
      </div>
      <h1 className="text-3xl font-bold text-brand-dark mb-2">Food Seller Approvals</h1>
      <p className="text-brand-gray mb-8">
        Food Business Owner accounts only appear on Food once approved here.
      </p>

      <div className="bg-white rounded-2xl shadow-soft p-6">
        <AdminSellerApprovals
          sellers={sellers.map((seller) => ({
            id: seller.id,
            businessName: seller.businessName,
            ownerName: seller.user.name,
            email: seller.user.email,
            sellerType: seller.sellerType,
            isApproved: seller.isApproved,
            createdAt: seller.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
