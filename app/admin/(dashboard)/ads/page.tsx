import { redirect } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAllAdRequests } from '@/lib/promotions';
import { getMarketingAudienceSummary } from '@/lib/marketing-audience';
import { isSuperAdminLogin } from '@/lib/super-admin';
import AdminAdRequests from '@/components/AdminAdRequests';
import AdminMarketingAudience from '@/components/AdminMarketingAudience';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Ad Requests - Mangwaoo Admin',
};

export default async function AdminAdsPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const [ads, admin] = await Promise.all([
    getAllAdRequests(),
    prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } }),
  ]);
  const isSuperAdmin = isSuperAdminLogin(admin?.email);
  const audienceSummary = isSuperAdmin ? await getMarketingAudienceSummary() : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={60000} />
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <Megaphone className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Ad Requests</h1>
      <p className="mb-8 text-brand-gray">
        Sellers pay by EasyPaisa / JazzCash (Rs 500 for 7 days in the ad column or the Featured row, Rs 300 for a one-day
        story on the logo) and send the transaction ID. Check the payment, then approve the ad — it runs from the moment
        you approve it.
      </p>

      {audienceSummary ? <AdminMarketingAudience summary={audienceSummary} /> : null}
      <AdminAdRequests ads={ads} isSuperAdmin={isSuperAdmin} audienceSummary={audienceSummary} />
    </div>
  );
}
