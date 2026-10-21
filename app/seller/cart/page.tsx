import { ShoppingCart } from 'lucide-react';
import PendingCartList from '@/components/seller/PendingCartList';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { requireSeller } from '@/lib/seller-context';
import { getPendingCarts, sellerMarketplace } from '@/lib/seller-data';

export default async function PendingCartsPage() {
  const seller = await requireSeller();
  const items = await getPendingCarts(seller);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={ShoppingCart}
        title="Pending — still in cart"
        description="Customers who have your products in their cart but haven't ordered yet. Remove entries you've dealt with; one comes back only if the customer changes that item."
      />

      <PendingCartList marketplace={sellerMarketplace(seller)} items={items} />
    </div>
  );
}
