import { GULPLAZA_CATEGORIES } from '@/lib/data';
import { readPortions, withPortionLabel } from '@/lib/food-portions';
import { orderRef } from '@/lib/order-number';
import { prisma } from '@/lib/prisma';
import { isFoodSeller, type CurrentSeller } from '@/lib/seller-context';
import { parseSizeDetails } from '@/lib/size-options';
import { parseVehicleDetails } from '@/lib/vehicle-details';
import {
  FINISHED_STATUSES,
  INCOMING_STATUSES,
  type Marketplace,
  type PendingCartItem,
  type SellerCategory,
  type SellerOrder,
  type SellerProduct,
} from '@/lib/seller-types';

// Each query is scoped to one seller and kept to a single round trip — the database is remote.

export function sellerMarketplace(seller: CurrentSeller): Marketplace {
  return isFoodSeller(seller) ? 'GULPLAZA' : 'MART';
}

export async function getSellerCategories(seller: CurrentSeller): Promise<SellerCategory[]> {
  const categories = isFoodSeller(seller)
    ? await prisma.gulplazaCategory.findMany({
        // Food businesses file dishes under the food categories (older rows in this table are electronics).
        where: { name: { in: GULPLAZA_CATEGORIES.map((category) => category.name) } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    : await prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });

  return categories;
}

/** Listed products only: "delete" unlists a product, so unlisted ones are no longer shown. */
export async function getSellerProducts(seller: CurrentSeller): Promise<SellerProduct[]> {
  if (isFoodSeller(seller)) {
    const products = await prisma.gulplazaProduct.findMany({
      where: { sellerId: seller.id, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { name: true } } },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      price: Number(product.price),
      stock: product.stock,
      isActive: product.isActive,
      category: product.category.name,
      images: product.images,
      attributes: null,
      sizes: null,
      portions: readPortions(product.portions),
    }));
  }

  const products = await prisma.product.findMany({
    where: { sellerId: seller.id, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { name: true } } },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    price: Number(product.price),
    stock: product.stock,
    isActive: product.isActive,
    category: product.category.name,
    images: product.images,
    attributes: parseVehicleDetails(product.attributes),
    sizes: parseSizeDetails(product.attributes),
    portions: [],
  }));
}

export async function getSellerOrders(seller: CurrentSeller, scope: 'incoming' | 'completed'): Promise<SellerOrder[]> {
  const status = { in: [...(scope === 'incoming' ? INCOMING_STATUSES : FINISHED_STATUSES)] };

  if (isFoodSeller(seller)) {
    const orders = await prisma.gulplazaOrder.findMany({
      where: { sellerId: seller.id, sellerHidden: false, status },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: { include: { user: { select: { name: true } } } },
        address: true,
        payment: true,
      },
    });

    return orders.map((order) => ({
      id: order.id,
      ref: orderRef('gulplaza', order.orderNumber),
      marketplace: 'GULPLAZA' as const,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt.toISOString(),
      customerName: order.customer.user.name,
      address: `${order.address.street}, ${order.address.city}`,
      addressLabel: order.address.label,
      note: order.note,
      paymentMethod: order.payment?.method ?? null,
      paymentStatus: order.payment?.status ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        productName: withPortionLabel(item.product.name, item.portionGrams),
        quantity: item.quantity,
        price: Number(item.price),
      })),
    }));
  }

  const orders = await prisma.order.findMany({
    where: { sellerId: seller.id, sellerHidden: false, status },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { product: { select: { name: true } } } },
      customer: { include: { user: { select: { name: true } } } },
      address: true,
      payment: true,
    },
  });

  return orders.map((order) => ({
    id: order.id,
    ref: orderRef('mart', order.orderNumber),
    marketplace: 'MART' as const,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt.toISOString(),
    customerName: order.customer.user.name,
    address: `${order.address.street}, ${order.address.city}`,
    addressLabel: order.address.label,
    note: order.note,
    paymentMethod: order.payment?.method ?? null,
    paymentStatus: order.payment?.status ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.product.name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }));
}

/** Items customers have in their carts but haven't ordered, minus the ones the seller removed. */
export async function getPendingCarts(seller: CurrentSeller): Promise<PendingCartItem[]> {
  const items = await prisma.cartItem.findMany({
    where: { sellerId: seller.id, marketplace: sellerMarketplace(seller), dismissedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: { customer: { include: { user: { select: { name: true } } } } },
  });

  return items.map((item) => ({
    id: item.id,
    customerName: item.customer.user.name,
    productName: item.productName,
    quantity: item.quantity,
    price: Number(item.price),
    updatedAt: item.updatedAt.toISOString(),
  }));
}
