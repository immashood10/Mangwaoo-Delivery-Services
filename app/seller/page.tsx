import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SellerDashboard from '@/components/SellerDashboard';
import GulplazaSellerDashboard from '@/components/GulplazaSellerDashboard';

const SELLER_TYPE_LABELS: Record<string, string> = {
  GULPLAZA_OWNER: 'Food Business Owner',
  WHOLESALER: 'Food Business Owner',
};

export default async function SellerDashboardPage() {
  const session = await getSession();

  if (!session || session.role !== 'SELLER') {
    redirect('/sell');
  }

  const seller = await prisma.seller.findUnique({
    where: { userId: session.userId },
    include: { user: true },
  });

  if (!seller) {
    redirect('/sell');
  }

  if (seller.sellerType === 'GULPLAZA_OWNER' || seller.sellerType === 'WHOLESALER') {
    const [categories, products, orders, pendingCarts] = await Promise.all([
      prisma.gulplazaCategory.findMany({ orderBy: { name: 'asc' } }),
      prisma.gulplazaProduct.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      }),
      prisma.gulplazaOrder.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: true } },
          customer: { include: { user: true } },
          address: true,
          payment: true,
        },
      }),
      prisma.cartItem.findMany({
        where: { sellerId: seller.id, marketplace: 'GULPLAZA' },
        orderBy: { updatedAt: 'desc' },
        include: { customer: { include: { user: true } } },
      }),
    ]);

    return (
      <GulplazaSellerDashboard
        businessName={seller.businessName}
        ownerName={seller.user.name}
        sellerTypeLabel={SELLER_TYPE_LABELS[seller.sellerType] ?? seller.sellerType}
        isApproved={seller.isApproved}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          price: Number(product.price),
          stock: product.stock,
          isActive: product.isActive,
          category: product.category.name,
          images: product.images,
        }))}
        orders={orders.map((order) => ({
          id: order.id,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          createdAt: order.createdAt.toISOString(),
          customerName: order.customer.user.name,
          address: `${order.address.street}, ${order.address.city}`,
          addressLabel: order.address.label,
          paymentMethod: order.payment?.method ?? null,
          paymentStatus: order.payment?.status ?? null,
          items: order.items.map((item) => ({
            id: item.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: Number(item.price),
          })),
        }))}
        pendingCarts={pendingCarts.map((item) => ({
          id: item.id,
          customerName: item.customer.user.name,
          productName: item.productName,
          quantity: item.quantity,
          price: Number(item.price),
          updatedAt: item.updatedAt.toISOString(),
        }))}
      />
    );
  }

  const [categories, products, orders, pendingCarts] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.product.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    }),
    prisma.order.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        customer: { include: { user: true } },
        address: true,
        payment: true,
      },
    }),
    prisma.cartItem.findMany({
      where: { sellerId: seller.id, marketplace: 'MART' },
      orderBy: { updatedAt: 'desc' },
      include: { customer: { include: { user: true } } },
    }),
  ]);

  return (
    <SellerDashboard
      businessName={seller.businessName}
      ownerName={seller.user.name}
      isApproved={seller.isApproved}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        price: Number(product.price),
        stock: product.stock,
        isActive: product.isActive,
        category: product.category.name,
        images: product.images,
      }))}
      orders={orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt.toISOString(),
        customerName: order.customer.user.name,
        address: `${order.address.street}, ${order.address.city}`,
        addressLabel: order.address.label,
        paymentMethod: order.payment?.method ?? null,
        paymentStatus: order.payment?.status ?? null,
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.product.name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
      }))}
      pendingCarts={pendingCarts.map((item) => ({
        id: item.id,
        customerName: item.customer.user.name,
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
        updatedAt: item.updatedAt.toISOString(),
      }))}
    />
  );
}
