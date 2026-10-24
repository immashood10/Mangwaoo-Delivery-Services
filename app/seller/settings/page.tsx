import { CheckCircle2, Clock, Settings } from 'lucide-react';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import StoreProfileCard from '@/components/StoreProfileCard';
import { prisma } from '@/lib/prisma';
import { formatMonthYear } from '@/lib/ads';
import { isFoodSeller, requireSeller } from '@/lib/seller-context';

const SELLER_TYPE_LABELS: Record<string, string> = {
  MART: 'MangwaooMart vendor',
  GULPLAZA_OWNER: 'Food business owner',
  WHOLESALER: 'Food business owner',
};

export default async function SellerSettingsPage() {
  const seller = await requireSeller();
  const isFood = isFoodSeller(seller);
  const activeAds = isFood ? 0 : await prisma.product.count({ where: { sellerId: seller.id, isActive: true } });

  const details: { label: string; value: string }[] = [
    { label: 'Owner', value: seller.user.name },
    { label: 'Email', value: seller.user.email },
    { label: 'Phone', value: seller.user.phone ?? '—' },
    { label: 'Account type', value: SELLER_TYPE_LABELS[seller.sellerType] ?? seller.sellerType },
    { label: 'Member since', value: formatMonthYear(seller.createdAt) },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={Settings}
        title="Settings"
        description="Your store's name and location, as customers see them."
      />

      <StoreProfileCard
        sellerId={seller.id}
        businessName={seller.businessName}
        city={seller.city}
        country={seller.country}
        activeAds={activeAds}
        hasStorePage={!isFood}
        askMapLocation={isFood}
        askCover={isFood}
        coverSrc={isFood && seller.coverUpdatedAt ? `/api/seller/cover?v=${seller.coverUpdatedAt.getTime()}` : null}
        mapLocation={
          seller.latitude !== null && seller.longitude !== null && seller.locationLabel
            ? { label: seller.locationLabel, lat: seller.latitude, lng: seller.longitude }
            : null
        }
      />

      <section aria-labelledby="account-heading" className="rounded-2xl bg-surface p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="account-heading" className="text-lg font-bold text-ink">
            Your account
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold ${
              seller.isApproved ? 'bg-green-50 text-success' : 'bg-yellow-50 text-warning'
            }`}
          >
            {seller.isApproved ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {seller.isApproved ? 'Approved seller' : 'Pending approval'}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs text-brand-gray">{detail.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
