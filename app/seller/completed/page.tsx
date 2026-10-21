import { CheckCircle2 } from 'lucide-react';
import OrdersList from '@/components/seller/OrdersList';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { requireSeller } from '@/lib/seller-context';
import { getSellerOrders } from '@/lib/seller-data';

export default async function CompletedOrdersPage() {
  const seller = await requireSeller();
  const orders = await getSellerOrders(seller, 'completed');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={CheckCircle2}
        title="Completed orders"
        description="Orders that were delivered or cancelled. They stay here until you remove them; removing one only clears it from your list."
      />

      <OrdersList orders={orders} mode="completed" />
    </div>
  );
}
