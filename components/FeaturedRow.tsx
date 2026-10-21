import type { AdCardData } from '@/lib/ads';
import AdCard from './AdCard';

/** The "Featured" row of paid main-page ads (home page, top of MangwaooMart). Renders nothing without ads. */
export default function FeaturedRow({
  ads,
  title = 'Featured',
  className = '',
}: {
  ads: AdCardData[];
  title?: string;
  className?: string;
}) {
  if (ads.length === 0) return null;

  return (
    <section aria-labelledby="featured-row-heading" className={className}>
      <h2 id="featured-row-heading" className="mb-4 text-xl font-bold text-ink">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {ads.map((ad) => (
          <AdCard key={ad.id} ad={ad} featured />
        ))}
      </div>
    </section>
  );
}
