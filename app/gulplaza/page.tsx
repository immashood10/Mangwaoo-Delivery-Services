import Link from 'next/link';
import { GULPLAZA_ADS, GULPLAZA_CATEGORIES } from '@/lib/data';
import { MessageCircle, Store, X, LayoutGrid } from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import NearbyNotice from '@/components/NearbyNotice';
import { FOOD_DELIVERY_RADIUS_KM, foodReach } from '@/lib/delivery';
import { isRealLocation, parseCoordinates, type Coordinates } from '@/lib/geo';
import { getGulplazaProducts } from '@/lib/products';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon])
);

/** A link to this page with the search words, the category and (so the 5 km list stays) the customer's location. */
function buildCategoryHref(q: string | undefined, categoryName?: string, origin?: Coordinates | null) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoryName) params.set('category', categoryName);
  if (origin) {
    params.set('lat', String(origin.lat));
    params.set('lng', String(origin.lng));
  }
  const qs = params.toString();
  return `/gulplaza${qs ? `?${qs}` : ''}`;
}

export default async function GulPlaza({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; lat?: string; lng?: string }>;
}) {
  const { q, category, lat, lng } = await searchParams;
  const query = q?.trim().toLowerCase() ?? '';
  const selectedCategory = category?.trim() || null;
  const parsedOrigin = parseCoordinates(lat, lng);
  const origin = isRealLocation(parsedOrigin) ? parsedOrigin : null;

  // Only dishes from restaurants within 5 km of the customer are listed. The customer's location comes with the
  // address (`?lat=&lng=`, kept in step by NearbyNotice); without one nothing can be listed, and a restaurant that
  // hasn't pinned its kitchen on the map can't be listed either (nobody can tell how far it is).
  const sellerProducts = origin
    ? (await getGulplazaProducts()).filter(
        (product) =>
          foodReach(
            origin,
            product.seller.latitude !== null && product.seller.longitude !== null
              ? { lat: product.seller.latitude, lng: product.seller.longitude }
              : null
          ).status === 'OK'
      )
    : [];

  const allProducts = sellerProducts.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category.name,
    vendor: product.seller.businessName,
    sellerId: product.sellerId,
    marketplace: 'gulplaza' as const,
    price: `PKR ${Number(product.price).toLocaleString()}`,
    icon: CATEGORY_ICONS[product.category.name] ?? '🍽️',
    imageUrl: product.images[0] ?? null,
  }));

  const products = allProducts
    .filter((product) =>
      query
        ? product.name.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          product.vendor.toLowerCase().includes(query)
        : true
    )
    .filter((product) => (selectedCategory ? product.category === selectedCategory : true));

  const hasResults = products.length > 0;

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold mb-4">
            Food
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-6">
            Restaurants, Bakeries &amp; Home Kitchens
          </h1>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto mb-8">
            Shop from approved food businesses across Karachi &mdash; verified sellers only.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/gulplaza#shop"
              className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all duration-300"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Start Shopping for Food</span>
            </Link>
            <Link
              href="/sell"
              className="inline-flex items-center justify-center space-x-2 border-2 border-accent text-accent px-8 py-4 rounded-2xl font-semibold hover:bg-brand-red-primary hover:text-white transition-all duration-300"
            >
              <Store className="w-5 h-5" />
              <span>Sell Food on Mangwaoo</span>
            </Link>
          </div>
        </div>
      </section>

      {query && origin && (
        <section className="py-6 bg-surface border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-gray">
              {hasResults ? (
                <>
                  Showing results for <span className="font-semibold text-ink">&ldquo;{q}&rdquo;</span>
                </>
              ) : (
                <>
                  No results for <span className="font-semibold text-ink">&ldquo;{q}&rdquo;</span>
                </>
              )}
            </p>
            <Link
              href={buildCategoryHref(undefined, undefined, origin)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              <X className="w-4 h-4" />
              Clear search
            </Link>
          </div>
        </section>
      )}

      {query && origin && !hasResults && (
        <section className="py-16 text-center">
          <p className="text-brand-gray">
            We couldn&apos;t find anything matching your search. Try a different keyword or{' '}
            <Link href={buildCategoryHref(undefined, undefined, origin)} className="text-accent font-semibold hover:underline">
              browse the full catalog
            </Link>
            .
          </p>
        </section>
      )}

      {/* Products */}
      <section id="shop" className="py-16 md:py-24 bg-brand-light scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
            {/* Categories */}
            <aside className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
              <div className="rounded-2xl border border-gray-100 bg-surface p-4 shadow-soft">
                <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-brand-gray">
                  Categories
                </h3>
                <nav className="space-y-1">
                  <Link
                    href={buildCategoryHref(q, undefined, origin)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      !selectedCategory
                        ? 'bg-brand-red-primary/10 text-accent'
                        : 'text-ink hover:bg-brand-light'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    All Categories
                  </Link>
                  {GULPLAZA_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.id}
                      href={buildCategoryHref(q, cat.name, origin)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        selectedCategory === cat.name
                          ? 'bg-brand-red-primary/10 text-accent'
                          : 'text-ink hover:bg-brand-light'
                      }`}
                    >
                      <span className="text-lg leading-none">{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Product grid */}
            <div className="min-w-0 flex-1">
              <div className="mb-10">
                <h2 className="text-3xl md:text-4xl font-bold text-ink mb-3">
                  {selectedCategory ?? 'Food Listings'}
                </h2>
                <p className="text-lg text-brand-gray">
                  {selectedCategory
                    ? `Browsing ${selectedCategory} from approved food sellers within ${FOOD_DELIVERY_RADIUS_KM} km of you.`
                    : `Listings from approved food businesses within ${FOOD_DELIVERY_RADIUS_KM} km of you.`}
                </p>
              </div>

              <NearbyNotice
                lat={origin?.lat ?? null}
                lng={origin?.lng ?? null}
                params={{ ...(q ? { q } : {}), ...(selectedCategory ? { category: selectedCategory } : {}) }}
                what="dishes"
              />

              {!origin ? null : products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="bg-surface rounded-2xl shadow-soft hover:shadow-md transition-all duration-300"
                    >
                      <Link
                        href={`/gulplaza/${product.id}${origin ? `?lat=${origin.lat}&lng=${origin.lng}` : ''}`}
                        className="flex h-full flex-col p-5"
                      >
                        {product.imageUrl ? (
                          <div className="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-brand-light">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="text-4xl mb-3">{product.icon}</div>
                        )}
                        <h3 className="font-semibold text-ink text-sm mb-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-brand-gray mb-3">{product.vendor}</p>
                        <div className="mt-auto flex items-center justify-between">
                          <span className="font-bold text-accent">{product.price}</span>
                          <AddToCartButton
                            product={product}
                            className="text-xs font-semibold bg-brand-red-primary text-white px-3 py-2 rounded-full hover:bg-brand-red-secondary transition-colors"
                          />
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-brand-gray text-sm">
                  {sellerProducts.length === 0
                    ? `No restaurant within ${FOOD_DELIVERY_RADIUS_KM} km of your address has listed food yet. Try another delivery address.`
                    : selectedCategory
                      ? `No listings found in ${selectedCategory} within ${FOOD_DELIVERY_RADIUS_KM} km yet. Try `
                      : `No matching listings within ${FOOD_DELIVERY_RADIUS_KM} km. Try `}
                  {sellerProducts.length === 0 ? null : (
                    <>
                      <Link href={buildCategoryHref(q, undefined, origin)} className="text-accent font-semibold hover:underline">
                        another category
                      </Link>
                      .
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Ads */}
            <aside className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0 space-y-4">
              {GULPLAZA_ADS.map((ad) =>
                ad.external ? (
                  <a
                    key={ad.id}
                    href={ad.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-2xl border border-gray-100 bg-surface shadow-soft transition-all duration-300 hover:shadow-md"
                  >
                    <img src={ad.image} alt={ad.title} className="h-28 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-sm font-bold text-ink mb-1">{ad.title}</p>
                      <p className="text-xs text-brand-gray mb-3">{ad.description}</p>
                      <span className="inline-flex items-center text-xs font-semibold text-accent hover:underline">
                        {ad.ctaLabel}
                      </span>
                    </div>
                  </a>
                ) : (
                  <Link
                    key={ad.id}
                    href={ad.href}
                    className="block overflow-hidden rounded-2xl border border-gray-100 bg-surface shadow-soft transition-all duration-300 hover:shadow-md"
                  >
                    <img src={ad.image} alt={ad.title} className="h-28 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-sm font-bold text-ink mb-1">{ad.title}</p>
                      <p className="text-xs text-brand-gray mb-3">{ad.description}</p>
                      <span className="inline-flex items-center text-xs font-semibold text-accent hover:underline">
                        {ad.ctaLabel}
                      </span>
                    </div>
                  </Link>
                )
              )}
            </aside>
          </div>
        </div>
      </section>

      {/* Sell on Food */}
      <section id="sell-on-gulplaza" className="py-16 md:py-24 bg-surface scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-brand-red-primary to-brand-red-secondary rounded-3xl p-8 md:p-12 text-white text-center">
            <Store className="w-12 h-12 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Sell Food on Mangwaoo
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
              Are you a restaurant, bakery, or home kitchen owner in Karachi? Apply to list your food business and reach more buyers. Accounts are manually reviewed before going live.
            </p>
            <Link
              href="/sell"
              className="inline-flex items-center space-x-2 bg-surface text-accent px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
            >
              <Store className="w-5 h-5" />
              <span>Apply to Sell</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
