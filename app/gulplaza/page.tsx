import Link from 'next/link';
import { GULPLAZA_ADS, GULPLAZA_CATEGORIES } from '@/lib/data';
import { MessageCircle, Store, X, LayoutGrid } from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import { getGulplazaProducts } from '@/lib/products';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon])
);

function buildCategoryHref(q: string | undefined, categoryName?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoryName) params.set('category', categoryName);
  const qs = params.toString();
  return `/gulplaza${qs ? `?${qs}` : ''}`;
}

export default async function GulPlaza({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const query = q?.trim().toLowerCase() ?? '';
  const selectedCategory = category?.trim() || null;

  const sellerProducts = await getGulplazaProducts();

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
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-brand-red-primary rounded-full text-sm font-semibold mb-4">
            Food
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-brand-dark mb-6">
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
              className="inline-flex items-center justify-center space-x-2 border-2 border-brand-red-primary text-brand-red-primary px-8 py-4 rounded-2xl font-semibold hover:bg-brand-red-primary hover:text-white transition-all duration-300"
            >
              <Store className="w-5 h-5" />
              <span>Sell Food on Mangwaoo</span>
            </Link>
          </div>
        </div>
      </section>

      {query && (
        <section className="py-6 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-gray">
              {hasResults ? (
                <>
                  Showing results for <span className="font-semibold text-brand-dark">&ldquo;{q}&rdquo;</span>
                </>
              ) : (
                <>
                  No results for <span className="font-semibold text-brand-dark">&ldquo;{q}&rdquo;</span>
                </>
              )}
            </p>
            <Link
              href="/gulplaza"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-red-primary hover:underline"
            >
              <X className="w-4 h-4" />
              Clear search
            </Link>
          </div>
        </section>
      )}

      {query && !hasResults && (
        <section className="py-16 text-center">
          <p className="text-brand-gray">
            We couldn&apos;t find anything matching your search. Try a different keyword or{' '}
            <Link href="/gulplaza" className="text-brand-red-primary font-semibold hover:underline">
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
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-soft">
                <h3 className="mb-3 px-2 text-xs font-bold uppercase tracking-wide text-brand-gray">
                  Categories
                </h3>
                <nav className="space-y-1">
                  <Link
                    href={buildCategoryHref(q)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      !selectedCategory
                        ? 'bg-brand-red-primary/10 text-brand-red-primary'
                        : 'text-brand-dark hover:bg-brand-light'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    All Categories
                  </Link>
                  {GULPLAZA_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.id}
                      href={buildCategoryHref(q, cat.name)}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        selectedCategory === cat.name
                          ? 'bg-brand-red-primary/10 text-brand-red-primary'
                          : 'text-brand-dark hover:bg-brand-light'
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
                <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-3">
                  {selectedCategory ?? 'Food Listings'}
                </h2>
                <p className="text-lg text-brand-gray">
                  {selectedCategory
                    ? `Browsing ${selectedCategory} from approved food sellers.`
                    : 'Listings from approved food businesses across Karachi.'}
                </p>
              </div>

              {products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl shadow-soft hover:shadow-md transition-all duration-300"
                    >
                      <Link href={`/gulplaza/${product.id}`} className="flex h-full flex-col p-5">
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
                        <h3 className="font-semibold text-brand-dark text-sm mb-1">
                          {product.name}
                        </h3>
                        <p className="text-xs text-brand-gray mb-3">{product.vendor}</p>
                        <div className="mt-auto flex items-center justify-between">
                          <span className="font-bold text-brand-red-primary">{product.price}</span>
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
                  {selectedCategory
                    ? `No listings found in ${selectedCategory} yet. Try `
                    : 'No food listings yet — approved sellers will appear here. Try '}
                  <Link href={buildCategoryHref(q)} className="text-brand-red-primary font-semibold hover:underline">
                    another category
                  </Link>
                  .
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
                    className="block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-soft transition-all duration-300 hover:shadow-md"
                  >
                    <img src={ad.image} alt={ad.title} className="h-28 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-sm font-bold text-brand-dark mb-1">{ad.title}</p>
                      <p className="text-xs text-brand-gray mb-3">{ad.description}</p>
                      <span className="inline-flex items-center text-xs font-semibold text-brand-red-primary hover:underline">
                        {ad.ctaLabel}
                      </span>
                    </div>
                  </a>
                ) : (
                  <Link
                    key={ad.id}
                    href={ad.href}
                    className="block overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-soft transition-all duration-300 hover:shadow-md"
                  >
                    <img src={ad.image} alt={ad.title} className="h-28 w-full object-cover" />
                    <div className="p-4">
                      <p className="text-sm font-bold text-brand-dark mb-1">{ad.title}</p>
                      <p className="text-xs text-brand-gray mb-3">{ad.description}</p>
                      <span className="inline-flex items-center text-xs font-semibold text-brand-red-primary hover:underline">
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
      <section id="sell-on-gulplaza" className="py-16 md:py-24 bg-white scroll-mt-20">
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
              className="inline-flex items-center space-x-2 bg-white text-brand-red-primary px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
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
