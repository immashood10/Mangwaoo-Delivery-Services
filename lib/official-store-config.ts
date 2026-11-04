// Client-safe constants of Mangwaoo's own store (the server side is lib/official-store.ts).

export const OFFICIAL_STORE_NAME = 'Mangwaoo';
/** The header an admin's browser sends to /api/seller/products to act as the official store. */
export const STORE_HEADER = 'x-mangwaoo-store';
export const STORE_HEADER_VALUE = 'official';
