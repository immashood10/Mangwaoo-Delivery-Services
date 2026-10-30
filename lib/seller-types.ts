// Shapes the seller dashboard pages pass to their client components. Client-safe.

import type { Portion } from '@/lib/food-portions';
import type { SizeDetails } from '@/lib/size-options';
import type { VehicleDetails } from '@/lib/vehicle-details';
import type { FoodDishTag, FoodSpiceLevelKey } from '@/lib/food-ai-metadata';

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
  /** Food dishes sold by weight (250 g, 500 g, 1 kg ...) with a price each; empty = a dish with one price. */
  portions: Portion[];
  /** Food listing metadata; null/empty for old unclassified dishes and non-food products. */
  spiceLevel: FoodSpiceLevelKey | null;
  dishTags: FoodDishTag[];
};

export type SellerOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  price: number;
};

export type SellerOrder = {
  id: string;
  /** The order number the customer sees too, e.g. MW-F10001. */
  ref: string;
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
