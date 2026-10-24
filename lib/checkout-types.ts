// What the checkout calculation (lib/checkout.ts, on the server) hands to the cart page.

export type Marketplace = 'mart' | 'gulplaza';

export type CouponInfo = {
  code: string;
  percent: number;
  description: string | null;
  maxDiscountAmount: number | null;
};

/** What one order of the checkout costs. A cart with items from three sellers makes three orders. */
export type OrderQuote = {
  marketplace: Marketplace;
  sellerId: string;
  sellerName: string;
  /** The items (what the seller earns). */
  subtotal: number;
  /** Food only: the petrol cost from the restaurant to the customer. Always 0 for MangwaooMart. */
  deliveryFee: number;
  /** Food only: the distance the fee is for (billed to 0.1 km). */
  distanceKm: number | null;
  /**
   * Food only: why this order can't go ahead as it is. The customer hasn't pinned a location, the restaurant hasn't pinned
   * its kitchen (so nobody can tell how far it is), or it is farther than the delivery radius (5 km) from the drop-off.
   * Checkout refuses all three.
   */
  deliveryNote: 'NEEDS_DROPOFF' | 'NO_RESTAURANT_PIN' | 'OUT_OF_RANGE' | null;
  discount: number;
  /** What the customer pays for this order: items − discount + delivery. */
  total: number;
};

export type Quote = {
  orders: OrderQuote[];
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
  coupon: CouponInfo | null;
};
