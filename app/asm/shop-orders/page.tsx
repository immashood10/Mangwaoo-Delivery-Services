import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { findManager } from '@/lib/area-managers';
import { listFulfillmentOrders } from '@/lib/order-fulfillment';
import AsmShopOrders from '@/components/asm/AsmShopOrders';
import AutoRefresh from '@/components/AutoRefresh';

export const metadata = {
  title: 'Shop orders - Mangwaoo',
};

export default async function AsmShopOrdersPage() {
  const session = await getSession();

  if (!session || session.role !== 'ASM') redirect('/login?next=/asm/shop-orders');

  const manager = await findManager(session.userId);

  if (!manager) redirect('/login');

  const orders = await listFulfillmentOrders(manager.areaId);
  const waiting = orders.filter((order) => order.status === 'PENDING').length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <AutoRefresh intervalMs={10000} />
      <h1 className="mb-1 text-2xl font-bold text-ink">Shop orders · {manager.areaName}</h1>
      <p className="mb-6 text-sm text-brand-gray">
        Orders customers of your area placed with vendors (food and MangwaooMart). You accept each order, follow it while it is prepared,
        mark it given to the rider and delivered, or cancel it. Vendors can see their orders but cannot change them.
        {waiting > 0 ? ` ${waiting} ${waiting === 1 ? 'order is' : 'orders are'} waiting to be accepted.` : ''}
      </p>

      <AsmShopOrders orders={orders} />
    </div>
  );
}
