import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import BuyerDashboard from '@/components/BuyerDashboard';

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

  const [martOrders, gulplazaOrders] = await Promise.all([
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

  return <BuyerDashboard key={initialTab} customerName={customer.user.name} orders={orders} initialTab={initialTab} />;
}
