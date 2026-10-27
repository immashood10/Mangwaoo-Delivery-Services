import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BuyerDashboard from '@/components/BuyerDashboard';

/** How long after a delivery the account page keeps asking the customer to rate the rider. */
const RATE_REMINDER_DAYS = 7;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const initialTab = tab === 'history' || tab === 'messages' ? tab : 'orders';
  const session = await getSession();

  if (!session || session.role !== 'CUSTOMER') {
    redirect(`/login?next=${encodeURIComponent(initialTab === 'orders' ? '/account' : `/account?tab=${initialTab}`)}`);
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.userId },
    include: { user: true },
  });

  if (!customer) {
    redirect('/login?next=/account');
  }

  // Rides delivered in the last week that the customer has not rated yet: a reminder with a link, for those who closed the form.
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const ratableSince = new Date(Date.now() - RATE_REMINDER_DAYS * 24 * 60 * 60 * 1000);

  const [martOrders, gulplazaOrders, unratedRides] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        seller: true,
        address: true,
        payment: true,
        coupon: { select: { code: true } },
      },
    }),
    prisma.gulplazaOrder.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        seller: true,
        address: true,
        payment: true,
        coupon: { select: { code: true } },
      },
    }),
    prisma.riderOrderRecord.findMany({
      where: { customerId: customer.id, status: 'DELIVERED', stars: null, endedAt: { gte: ratableSince } },
      orderBy: { endedAt: 'desc' },
      take: 3,
      select: { chatId: true, endedAt: true, rider: { select: { user: { select: { name: true } } } } },
    }),
  ]);

  const orders = [
    ...martOrders.map((order) => ({
      id: order.id,
      marketplace: 'mart' as const,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      deliveryFee: 0,
      discountAmount: Number(order.discountAmount),
      couponCode: order.coupon?.code ?? null,
      createdAt: order.createdAt.toISOString(),
      sellerName: order.seller.businessName,
      address: `${order.address.street}, ${order.address.city}`,
      paymentMethod: order.payment?.method ?? null,
      paymentStatus: order.payment?.status ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: Number(item.price),
      })),
    })),
    ...gulplazaOrders.map((order) => ({
      id: order.id,
      marketplace: 'gulplaza' as const,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      deliveryFee: Number(order.deliveryFee),
      discountAmount: Number(order.discountAmount),
      couponCode: order.coupon?.code ?? null,
      createdAt: order.createdAt.toISOString(),
      sellerName: order.seller.businessName,
      address: `${order.address.street}, ${order.address.city}`,
      paymentMethod: order.payment?.method ?? null,
      paymentStatus: order.payment?.status ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: Number(item.price),
      })),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const ratePrompts = unratedRides.map((ride) => ({
    chatId: ride.chatId,
    riderName: ride.rider.user.name,
    deliveredAt: ride.endedAt.toISOString(),
  }));

  return <BuyerDashboard key={initialTab} customerName={customer.user.name} orders={orders} ratePrompts={ratePrompts} initialTab={initialTab} />;
}
