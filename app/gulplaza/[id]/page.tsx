import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import { GULPLAZA_CATEGORIES } from '@/lib/data';
import { FOOD_DELIVERY_RADIUS_KM, foodReach } from '@/lib/delivery';
import { formatDistance, isRealLocation, parseCoordinates } from '@/lib/geo';
import { prisma } from '@/lib/prisma';
import AddToCartButton from '@/components/AddToCartButton';
import ChatWidget from '@/components/ChatWidget';
import FavouriteButton from '@/components/FavouriteButton';
import NearbyNotice from '@/components/NearbyNotice';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon])
);

export default async function GulplazaProductDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const [{ id }, { lat, lng }] = await Promise.all([params, searchParams]);

  const dbProduct = await prisma.gulplazaProduct.findFirst({
    where: {
      id,
      isActive: true,
      seller: { isApproved: true, sellerType: { in: ['GULPLAZA_OWNER', 'WHOLESALER'] } },
    },
    include: { category: true, seller: true },
  });

  if (!dbProduct) {
    notFound();
  }

  const product = {
    id: dbProduct.id,
    name: dbProduct.name,
    category: dbProduct.category.name,
    vendor: dbProduct.seller.businessName,
    sellerId: dbProduct.sellerId,
    marketplace: 'gulplaza' as const,
    price: `PKR ${Number(dbProduct.price).toLocaleString()}`,
    icon: CATEGORY_ICONS[dbProduct.category.name] ?? '🍽️',
    imageUrl: dbProduct.images[0] ?? null,
    description:
      dbProduct.description?.trim() ||
      `${dbProduct.category.name} from ${dbProduct.seller.businessName}, available on Food.`,
    stock: dbProduct.stock,
  };

  // Food is only for customers within 5 km of the restaurant: the dish can be looked at, but not ordered, from farther away
  // (or when the restaurant hasn't pinned its kitchen, so nobody can tell how far it is).
  const parsedOrigin = parseCoordinates(lat, lng);
  const origin = isRealLocation(parsedOrigin) ? parsedOrigin : null;
  const reach = foodReach(
    origin,
    dbProduct.seller.latitude !== null && dbProduct.seller.longitude !== null
      ? { lat: dbProduct.seller.latitude, lng: dbProduct.seller.longitude }
      : null
  );
  const outOfArea = origin !== null && (reach.status === 'TOO_FAR' || reach.status === 'NO_PIN');
  const nearbyHref = origin ? `/gulplaza?lat=${origin.lat}&lng=${origin.lng}` : '/gulplaza';

  return (
    <div className="w-full py-12 md:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <NearbyNotice lat={origin?.lat ?? null} lng={origin?.lng ?? null} variant="quiet" />
        <Link
          href={nearbyHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Food
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div className="rounded-3xl bg-brand-light flex items-center justify-center overflow-hidden aspect-square">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-8xl">{product.icon}</span>
            )}
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-block px-3 py-1 bg-brand-red-primary/10 text-accent rounded-full text-xs font-semibold">
                {product.category}
              </span>
              <FavouriteButton kind="DISH" id={product.id} name={product.name} variant="outline" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-ink">{product.name}</h1>
            <p className="text-sm text-brand-gray">Sold by {product.vendor}</p>
            <p className="text-3xl font-bold text-accent">{product.price}</p>

            <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-success' : 'text-danger'}`}>
              {product.stock > 0 ? 'Available' : 'Currently unavailable'}
            </p>

            <div>
              <h2 className="text-sm font-bold text-ink mb-2">Description</h2>
              <p className="text-brand-gray leading-relaxed">{product.description}</p>
            </div>

            {outOfArea ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <MapPin className="h-4 w-4 text-warning" />
                  Not available at your address
                </p>
                <p className="mt-1 text-brand-gray">
                  {reach.status === 'TOO_FAR'
                    ? `${product.vendor} is ${formatDistance(reach.distanceKm)} from your delivery address, and we deliver food only from restaurants within ${FOOD_DELIVERY_RADIUS_KM} km of you.`
                    : `${product.vendor} hasn't set its location on the map yet, so we can't check that it is within ${FOOD_DELIVERY_RADIUS_KM} km of you.`}
                </p>
                <Link href={nearbyHref} className="mt-2 inline-block font-semibold text-accent hover:underline">
                  See food near you
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <AddToCartButton
                  product={product}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-8 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
                />
                <ChatWidget sellerId={product.sellerId} sellerName={product.vendor} productName={product.name} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
