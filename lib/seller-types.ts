// Shapes the seller dashboard pages pass to their client components. Client-safe.

import type { SizeDetails } from '@/lib/size-options';
import type { VehicleDetails } from '@/lib/vehicle-details';

export type Marketplace = 'MART' | 'GULPLAZA';

export type SellerCategory = { id: string; name: string };

export type SellerProduct = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  price: number;
  stock: number;
  isActive: boolean;
  category: string;
  images: string[];
  /** Vehicle ads (MangwaooMart) only. */
  attributes: VehicleDetails | null;
  /** Clothes and shoes (Men / Women / Kids on MangwaooMart) only. */
  sizes: SizeDetails | null;
};

export type SellerOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  price: number;
};

export type SellerOrder = {
  id: string;
  marketplace: Marketplace;
  status: string;
  totalAmount: number;
  createdAt: string;
  customerName: string;
  address: string;
  addressLabel: string | null;
  note: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  items: SellerOrderItem[];
};

export type PendingCartItem = {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  price: number;
  updatedAt: string;
};

/** Orders still being handled, and orders that are over. */
export const INCOMING_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'] as const;
export const FINISHED_STATUSES = ['DELIVERED', 'CANCELLED'] as const;
