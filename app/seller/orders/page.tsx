import { ClipboardList } from 'lucide-react';
import OrdersList from '@/components/seller/OrdersList';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { requireSeller } from '@/lib/seller-context';
import { getSellerOrders } from '@/lib/seller-data';

export default async function IncomingOrdersPage() {
  const seller = await requireSeller();
  const orders = await getSellerOrders(seller, 'incoming');

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={ClipboardList}
        title="Incoming orders"
        description="Orders waiting for you. Accept an order, move it along as you prepare and send it, and mark it delivered — it then moves to Completed orders."
      />

      <OrdersList orders={orders} mode="incoming" />
    </div>
  );
}
