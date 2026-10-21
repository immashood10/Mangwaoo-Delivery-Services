import { revalidateTag } from 'next/cache';

export const FOOD_CATALOG_TAG = 'gulplaza-products';
export const MART_CATALOG_TAG = 'mart-products';
export const STORIES_TAG = 'stories';

// `expire: 0` drops the cached catalog immediately (instead of serving it stale while
// it refreshes), so a seller's change shows up in search and menus on the next request.
export function refreshFoodCatalog() {
  revalidateTag(FOOD_CATALOG_TAG, { expire: 0 });
}

export function refreshMartCatalog() {
  revalidateTag(MART_CATALOG_TAG, { expire: 0 });
}

// A story the admin just posted or removed must show up (or go) on the logo straight away.
export function refreshStories() {
  revalidateTag(STORIES_TAG, { expire: 0 });
}
