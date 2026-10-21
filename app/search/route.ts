import { NextRequest, NextResponse } from 'next/server';
import { getMartProducts } from '@/lib/products';
import { normalizeQuery, searchRestaurants } from '@/lib/food-search';
import { parseCoordinates } from '@/lib/geo';

/**
 * Search entry point. A real 307 (instead of a page-level redirect, which Next
 * streams behind the loading screen) so the customer lands on the right page
 * straight away:
 *  - one restaurant has the dish  -> that restaurant's page, matching items on top
 *  - several restaurants have it  -> a list, nearest to the customer's address first
 *  - none, but MangwaooMart does  -> the mart search
 *
 * The customer's delivery address travels along as `lat` and `lng` so the next page can
 * sort by distance and show how far each restaurant is.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const raw = params.get('q')?.trim() ?? '';
  const query = normalizeQuery(raw);
  const origin = parseCoordinates(params.get('lat') ?? undefined, params.get('lng') ?? undefined);
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url), 307);
  const withOrigin = (path: string) => (origin ? `${path}&lat=${origin.lat}&lng=${origin.lng}` : path);

  if (!query) {
    return go('/gulplaza');
  }

  const results = await searchRestaurants(query, origin);

  if (results.length === 1) {
    return go(withOrigin(`/restaurant/${results[0].restaurant.id}?q=${encodeURIComponent(raw)}`));
  }

  if (results.length > 1) {
    return go(withOrigin(`/search/results?q=${encodeURIComponent(raw)}`));
  }

  const words = query.split(' ');
  const martProducts = await getMartProducts();
  const martHasMatch = martProducts.some((product) => {
    const haystack = `${product.name} ${product.category.name} ${product.seller.businessName}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });

  return go(martHasMatch ? `/mart?q=${encodeURIComponent(raw)}` : withOrigin(`/search/results?q=${encodeURIComponent(raw)}`));
}
