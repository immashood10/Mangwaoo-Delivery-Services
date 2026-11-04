import { ClipboardList } from 'lucide-react';
import OrdersList from '@/components/seller/OrdersList';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { canChangeOrderStatus, requireSeller } from '@/lib/seller-context';
import { getSellerOrders } from '@/lib/seller-data';

export default async function IncomingOrdersPage() {
  const seller = await requireSeller();
  const orders = await getSellerOrders(seller, 'incoming');
  // Shop owners and MangwaooMart vendors only receive and prepare orders: Mangwaoo's team updates their status. Small food businesses update their own.
  const canUpdateStatus = canChangeOrderStatus(seller);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={ClipboardList}
        title="Incoming orders"
        description={
          canUpdateStatus
            ? 'Orders waiting for you. Accept an order, move it along as you prepare and send it, and mark it delivered — it then moves to Completed orders.'
            : "Orders placed for your products. Mangwaoo's team accepts them and updates their status; you prepare what was ordered and you are told when the rider has delivered it."
        }
      />

      <OrdersList orders={orders} mode="incoming" canUpdateStatus={canUpdateStatus} />
    </div>
  );
}
