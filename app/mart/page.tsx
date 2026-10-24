import Link from 'next/link';
import { MART_ADS, MART_CATEGORIES, MART_PRODUCTS } from '@/lib/data';
import { Store, X, LayoutGrid } from 'lucide-react';
import AddToCartButton from '@/components/AddToCartButton';
import CartBar from '@/components/CartBar';
import FeaturedRow from '@/components/FeaturedRow';
import SidebarAdCard from '@/components/SidebarAdCard';
import { getMartProducts } from '@/lib/products';
import { getRunningAds } from '@/lib/promotions';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  MART_CATEGORIES.map((category) => [category.name, category.icon])
);

function buildCategoryHref(q: string | undefined, categoryName?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (categoryName) params.set('category', categoryName);
  const qs = params.toString();
  return `/mart${qs ? `?${qs}` : ''}`;
}

export default async function MangwaooMart({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const query = q?.trim().toLowerCase() ?? '';
  const selectedCategory = category?.trim() || null;

  // Paid ads load alongside the catalog. The Featured row is left out of search results.
  const [sellerProducts, sidebarAds, featuredAds] = await Promise.all([
    getMartProducts(),
    getRunningAds('SIDEBAR', 3),
    query ? Promise.resolve([]) : getRunningAds('MAIN_PAGE', 4, selectedCategory),
  ]);

  const allProducts = [
    ...sellerProducts.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category.name,
      vendor: product.seller.businessName,
      sellerId: product.sellerId,
      price: `PKR ${Number(product.price).toLocaleString()}`,
      icon: CATEGORY_ICONS[product.category.name] ?? '🛍️',
      imageUrl: product.images[0] ?? null,
    })),
    ...MART_PRODUCTS.map((product) => ({ ...product, imageUrl: null as string | null })),
  ];

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
      {query && (
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
              href="/mart"
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
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
            <Link href="/mart" className="text-accent font-semibold hover:underline">
              browse the full catalog
            </Link>
            .
          </p>
        </section>
      )}

      {/* Featured Products */}
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
                    href={buildCategoryHref(q)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      !selectedCategory
                        ? 'bg-brand-red-primary/10 text-accent'
                        : 'text-ink hover:bg-brand-light'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4 shrink-0" />
                    All Categories
                  </Link>
                  {MART_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.id}
                      href={buildCategoryHref(q, cat.name)}
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
                  {selectedCategory ?? 'Featured Products'}
                </h2>
                <p className="text-lg text-brand-gray">
                  {selectedCategory
                    ? `Browsing ${selectedCategory} from vendors on MangwaooMart.`
                    : "A sample of what's available from vendors on MangwaooMart today."}
                </p>
              </div>

              <FeaturedRow ads={featuredAds} title="Featured ads" className="mb-10" />

              {products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="bg-surface rounded-2xl shadow-soft hover:shadow-md transition-all duration-300"
                    >
                      <Link href={`/mart/${product.id}`} className="flex h-full flex-col p-5">
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
                  No products found{selectedCategory ? ` in ${selectedCategory}` : ''}. Try{' '}
                  <Link href={buildCategoryHref(q)} className="text-accent font-semibold hover:underline">
                    another category
                  </Link>
                  .
                </p>
              )}
            </div>

            {/* Ads */}
            <aside className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0 space-y-4">
              {sidebarAds.map((ad) => (
                <SidebarAdCard key={ad.id} ad={ad} />
              ))}
              {MART_ADS.map((ad) =>
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

      {/* Sell on MangwaooMart */}
      <section id="sell-on-mart" className="py-16 md:py-24 bg-surface scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-brand-red-primary to-brand-red-secondary rounded-3xl p-8 md:p-12 text-white text-center">
            <Store className="w-12 h-12 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Sell on MangwaooMart
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
              Are you a shop owner, grocer, or home business in Karachi? List your products on MangwaooMart and reach more customers with our delivery network.
            </p>
            <Link
              href="/sell"
              className="inline-flex items-center space-x-2 bg-surface text-accent px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
            >
              <Store className="w-5 h-5" />
              <span>Become a Vendor</span>
            </Link>
          </div>
        </div>
      </section>
      <CartBar spacer />
    </div>
  );
}
