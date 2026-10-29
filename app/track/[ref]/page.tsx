import { notFound, redirect } from 'next/navigation';
import OrderTracker from '@/components/OrderTracker';
import { getSession } from '@/lib/auth';
import { loadOrderTracking } from '@/lib/order-tracking';
import { trackingPath } from '@/lib/order-number';

export const metadata = {
  title: 'Track your order - Mangwaoo',
};

/**
 * Follow one order live. This is where the order notifications lead. Only the customer the order belongs to (and admins) can
 * open it; an order number that is not theirs looks exactly like one that does not exist.
 */
export default async function TrackOrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const session = await getSession();

  if (!session || (session.role !== 'CUSTOMER' && session.role !== 'ADMIN')) {
    redirect(`/login?next=${trackingPath(ref)}`);
  }

  const tracking = await loadOrderTracking(ref, session);

  if (!tracking) {
    notFound();
  }

  return <OrderTracker initial={tracking} />;
}
