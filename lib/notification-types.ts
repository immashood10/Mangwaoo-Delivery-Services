// Seller dashboard notifications. Client-safe: shared by the API, the layout and the bell.

export type NotificationKind = 'CART' | 'ORDER' | 'MESSAGE' | 'LIKE' | 'ACCOUNT' | 'AD';

export type SellerNotification = {
  id: string;
  type: NotificationKind;
  title: string;
  message: string;
  /** The dashboard page this is about; opening that page marks it as seen. */
  href: string | null;
  createdAt: string;
};

/** What a person sees when an admin writes to them from Admin > Users. */
export const ADMIN_MESSAGE_TITLE = 'Message from Mangwaoo';
export const MAX_ADMIN_MESSAGE_LENGTH = 500;

/** Unread notifications per dashboard page (keyed by href). */
export type NotificationCounts = Record<string, number>;

export type NotificationSnapshot = {
  items: SellerNotification[];
  counts: NotificationCounts;
};

/** Admin panel pages that notifications point at (plain paths, so opening the page marks them seen). */
export const ADMIN_PAGES = {
  users: '/admin/users',
  orders: '/admin/orders',
  chats: '/admin/rider-chats',
  messages: '/admin/messages',
  sellers: '/admin/sellers',
  riders: '/admin/riders',
  riderWallets: '/admin/rider-wallets',
  riderReviews: '/admin/rider-reviews',
  ads: '/admin/ads',
} as const;

export const SELLER_PAGES = {
  dashboard: '/seller/dashboard',
  sales: '/seller/sales',
  customers: '/seller/customers',
  allOrders: '/seller/all-orders',
  reports: '/seller/reports',
  post: '/seller',
  products: '/seller/products',
  cart: '/seller/cart',
  orders: '/seller/orders',
  completed: '/seller/completed',
  stats: '/seller/stats',
  ads: '/seller/ads',
  messages: '/seller/messages',
  settings: '/seller/settings',
} as const;
