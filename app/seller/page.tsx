import { PackagePlus } from 'lucide-react';
import PostProductForm from '@/components/seller/PostProductForm';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { isFoodSeller, requireSeller } from '@/lib/seller-context';
import { getSellerCategories, sellerMarketplace } from '@/lib/seller-data';

export default async function PostProductPage() {
  const seller = await requireSeller();
  const categories = await getSellerCategories(seller);
  const isFood = isFoodSeller(seller);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={PackagePlus}
        title="Post product"
        description={
          isFood
            ? 'Add a dish or item to your menu on Food.'
            : 'Add a product to MangwaooMart. Men, Women and Kids listings ask for sizes; choose the Vehicles category to post a bike or vehicle ad with its details.'
        }
      />

      {isFood && !seller.isApproved ? (
        <div className="mb-6 max-w-2xl rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-warning">
          Your account is pending manual review. You can post products now, but they won&apos;t appear on Food until
          your account is approved.
        </div>
      ) : null}

      <PostProductForm marketplace={sellerMarketplace(seller)} categories={categories} />
    </div>
  );
}
