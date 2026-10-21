import { Megaphone } from 'lucide-react';
import AdsManager from '@/components/seller/AdsManager';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { getSellerAds } from '@/lib/ads';
import { AD_PLACEMENTS } from '@/lib/ad-config';
import { getSellerAdRequests } from '@/lib/promotions';
import { isFoodSeller, requireSeller } from '@/lib/seller-context';

export default async function RunAnAdPage() {
  const seller = await requireSeller();

  if (isFoodSeller(seller)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <SellerPageHeader icon={Megaphone} title="Run an ad" />
        <p className="rounded-2xl bg-surface p-6 text-sm text-brand-gray shadow-soft">
          Ads are available for MangwaooMart products. They aren&apos;t open to food businesses yet.
        </p>
      </div>
    );
  }

  const [products, ads] = await Promise.all([getSellerAds(seller.id), getSellerAdRequests(seller.id)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={Megaphone}
        title="Run an ad"
        description={`Get a product in front of more customers: for 7 days in the right-hand ad column of MangwaooMart (Rs ${AD_PLACEMENTS.SIDEBAR.priceRs}) or in the Featured row on the main page (Rs ${AD_PLACEMENTS.MAIN_PAGE.priceRs}), or as a story on the Mangwaoo logo for one day (Rs ${AD_PLACEMENTS.STORY.priceRs}). Your ad is marked Featured.`}
      />

      <AdsManager products={products} ads={ads} />
    </div>
  );
}
