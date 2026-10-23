// Admin > Still in Cart: shapes and wording shared by the page's query (lib/admin-carts.ts) and its screen (client-safe).

/** How long a customer's cart has sat untouched before it is listed (the filter chips on the page). */
export const CART_AGE_FILTERS = [
  { value: 'all', label: 'All', minMs: 0 },
  { value: '1h', label: 'Waiting over 1 hour', minMs: 60 * 60 * 1000 },
  { value: '1d', label: 'Over 1 day', minMs: 24 * 60 * 60 * 1000 },
  { value: '3d', label: 'Over 3 days', minMs: 3 * 24 * 60 * 60 * 1000 },
] as const;

export type CartAge = (typeof CART_AGE_FILTERS)[number]['value'];

export function parseCartAge(value: string | undefined): CartAge {
  return CART_AGE_FILTERS.some((filter) => filter.value === value) ? (value as CartAge) : 'all';
}

/** "just now", "25 min", "3 h", "2 days". */
export function formatWaiting(ms: number) {
  const minutes = Math.floor(ms / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);

  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export type AdminCartItem = {
  id: string;
  productName: string;
  quantity: number;
  /** PKR for one. */
  price: number;
  /** The shop or restaurant the item is from. */
  store: string;
  marketplace: 'MART' | 'GULPLAZA';
  /** When the customer last changed this line, e.g. "25 min". */
  changed: string;
};

export type AdminCartCustomer = {
  customerId: string;
  /** The account id: what "Send notification" takes. */
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  /** How long since the customer last changed their cart, e.g. "3 h". */
  waiting: string;
  waitingMs: number;
  units: number;
  /** PKR for everything in the cart. */
  total: number;
  items: AdminCartItem[];
  /** The text of the "Remind" notification. */
  reminder: string;
};

export type AdminCartsData = {
  customers: AdminCartCustomer[];
  /** Everything waiting, whatever the filter. */
  totals: { customers: number; units: number; value: number };
  /** How many customers each filter chip would show. */
  ageCounts: Record<CartAge, number>;
  /** More customers match than are listed. */
  hidden: number;
};
