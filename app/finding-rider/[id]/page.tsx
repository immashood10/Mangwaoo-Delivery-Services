import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listLiveOrderLinks } from '@/lib/order-tracking';
import { getRiderChatSummary } from '@/lib/rider-chat';
import FindingRider from '@/components/FindingRider';

export const metadata = {
  title: 'Finding your rider - Mangwaoo',
};

export default async function FindingRiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect(`/login?next=/finding-rider/${id}`);
  }

  const [customer, chat] = await Promise.all([
    prisma.customer.findUnique({ where: { userId: session.userId }, select: { id: true } }),
    prisma.riderChat.findUnique({ where: { id }, select: { customerId: true } }),
  ]);

  // Same message for "doesn't exist" and "not yours" so chat ids can't be probed.
  if (!customer || !chat || chat.customerId !== customer.id) {
    notFound();
  }

  const [summary, liveOrders] = await Promise.all([getRiderChatSummary(id), listLiveOrderLinks(customer.id)]);

  if (!summary) {
    notFound();
  }

  return <FindingRider initialChat={summary} liveOrders={liveOrders} />;
}
