import Link from 'next/link';
import { Store, Trophy } from 'lucide-react';
import CartBar from '@/components/CartBar';
import MartProductCard, { type MartCardProduct } from '@/components/MartProductCard';
import { getMartProducts } from '@/lib/products';
import { SPORTS_CATEGORY, SPORT_FILTERS, findSportFilter, matchesSport } from '@/lib/sports';

export const metadata = {
  title: 'Sports - Mangwaoo',
  description: 'Cricket, football, badminton, gym and fitness gear from local sellers, delivered to your door in Karachi.',
};

// What a sports product without a photo shows (the category's icon on the Mart page).
const SPORTS_ICON = '🏏';

/**
 * The Sports option of the top menu. Sports gear is a MangwaooMart category: sellers post it like any other product and
 * customers order it through the same cart, so this page is that category with its own front door and quick filters by sport.
 */
export default async function SportsPage({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const { sport } = await searchParams;
  const filter = findSportFilter(sport?.trim());
  const sportsGear = (await getMartProducts()).filter((product) => product.category.name === SPORTS_CATEGORY);
  const shown = filter ? sportsGear.filter((product) => matchesSport(filter, `${product.name} ${product.description ?? ''}`)) : sportsGear;

  const products: MartCardProduct[] = shown.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category.name,
    vendor: product.seller.businessName,
    sellerId: product.sellerId,
    price: `PKR ${Number(product.price).toLocaleString()}`,
    icon: SPORTS_ICON,
    imageUrl: product.images[0] ?? null,
  }));

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-brand-light to-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red-primary/10 text-accent rounded-full text-sm font-semibold mb-4">
            <Trophy className="w-4 h-4" aria-hidden="true" />
            Sports
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-ink mb-6">Gear Up for the Game</h1>
          <p className="text-lg text-brand-gray max-w-2xl mx-auto mb-8">
            Cricket bats, footballs, badminton rackets, gym and fitness gear from local sellers, delivered to your door in Karachi.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#gear"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
            >
              Shop sports gear
            </a>
            <Link
              href="/sell"
              className="inline-flex items-center justify-center rounded-xl border border-accent px-6 py-3 text-sm font-semibold text-accent hover:bg-brand-red-primary hover:text-white transition-colors"
            >
              Sell your sports gear
            </Link>
          </div>
        </div>
      </section>

      {/* Browse by sport */}
      <section id="gear" className="py-12 md:py-16 bg-brand-light scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Browse by sport" className="mb-8 flex flex-wrap gap-2">
            <Link
              href="/sports#gear"
              aria-current={filter ? undefined : 'page'}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter ? 'bg-surface text-ink hover:bg-brand-red-primary/10' : 'bg-brand-red-primary text-white'
              }`}
            >
              All sports
            </Link>
            {SPORT_FILTERS.map((item) => (
              <Link
                key={item.slug}
                href={`/sports?sport=${item.slug}#gear`}
                aria-current={filter?.slug === item.slug ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  filter?.slug === item.slug ? 'bg-brand-red-primary text-white' : 'bg-surface text-ink hover:bg-brand-red-primary/10'
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-ink mb-2">{filter ? `${filter.name} gear` : 'Sports gear'}</h2>
            <p className="text-brand-gray" data-testid="sports-count">
              {products.length > 0
                ? `${products.length} ${products.length === 1 ? 'item' : 'items'} from vendors on MangwaooMart.`
                : 'Nothing listed here yet.'}
            </p>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6" data-testid="sports-products">
              {products.map((product) => (
                <MartProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : filter && sportsGear.length > 0 ? (
            <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
              <p className="text-lg font-bold text-ink mb-2">No {filter.name} gear listed yet</p>
              <p className="text-brand-gray mb-4">Other sports gear is available.</p>
              <Link href="/sports#gear" className="font-semibold text-accent hover:underline">
                Show all sports gear
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
              <div className="text-5xl mb-3" aria-hidden="true">
                {SPORTS_ICON}
              </div>
              <p className="text-lg font-bold text-ink mb-2">Sports gear is coming to MangwaooMart</p>
              <p className="text-brand-gray max-w-xl mx-auto mb-5">
                Are you a sports shop or seller? List your bats, balls, rackets and fitness gear and reach customers across Karachi.
              </p>
              <Link
                href="/sell"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
              >
                Become a Vendor
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Sell sports gear */}
      <section className="py-16 md:py-24 bg-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-brand-red-primary to-brand-red-secondary rounded-3xl p-8 md:p-12 text-white text-center">
            <Store className="w-12 h-12 mx-auto mb-6" aria-hidden="true" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Sell your sports gear</h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
              Post your products under Sports on MangwaooMart and let our delivery network bring them to your customers.
            </p>
            <Link
              href="/sell"
              className="inline-flex items-center space-x-2 bg-surface text-accent px-8 py-4 rounded-2xl font-semibold hover:shadow-2xl transition-all"
            >
              <Store className="w-5 h-5" aria-hidden="true" />
              <span>Become a Vendor</span>
            </Link>
          </div>
        </div>
      </section>
      <CartBar spacer />
    </div>
  );
}
