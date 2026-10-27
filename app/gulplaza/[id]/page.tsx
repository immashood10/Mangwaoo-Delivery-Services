import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info, MapPin } from 'lucide-react';
import { GULPLAZA_CATEGORIES } from '@/lib/data';
import { farAwayNote, foodReach } from '@/lib/delivery';
import { readPortions } from '@/lib/food-portions';
import { isRealLocation, parseCoordinates } from '@/lib/geo';
import { prisma } from '@/lib/prisma';
import AddToCartButton from '@/components/AddToCartButton';
import ChatWidget from '@/components/ChatWidget';
import { DishPortionChips, DishPortionOrderButton, DishPortionPrice, DishPortionsProvider } from '@/components/DishPortions';
import FavouriteButton from '@/components/FavouriteButton';
import NearbyNotice from '@/components/NearbyNotice';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon])
);

const ORDER_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-8 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300';

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

  // A dish sold by weight (250 g, 500 g, 1 kg ...): the customer picks a size, each with its own price.
  const portions = readPortions(dbProduct.portions);

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

  // The dish can be looked at from anywhere. It can be ordered whenever the restaurant has pinned its kitchen on the map (so
  // the distance, and the delivery charge, can be worked out); beyond 5 km the page adds a note that the charge is higher.
  const parsedOrigin = parseCoordinates(lat, lng);
  const origin = isRealLocation(parsedOrigin) ? parsedOrigin : null;
  const reach = foodReach(
    origin,
    dbProduct.seller.latitude !== null && dbProduct.seller.longitude !== null
      ? { lat: dbProduct.seller.latitude, lng: dbProduct.seller.longitude }
      : null
  );
  const outOfArea = origin !== null && reach.status === 'NO_PIN';
  const nearbyHref = origin ? `/gulplaza?lat=${origin.lat}&lng=${origin.lng}` : '/gulplaza';

  const details = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-block px-3 py-1 bg-brand-red-primary/10 text-accent rounded-full text-xs font-semibold">
          {product.category}
        </span>
        <FavouriteButton kind="DISH" id={product.id} name={product.name} variant="outline" />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-ink">{product.name}</h1>
      <p className="text-sm text-brand-gray">Sold by {product.vendor}</p>
      {portions.length > 0 ? (
        <>
          <DishPortionPrice className="text-3xl font-bold text-accent" />
          <DishPortionChips dishName={product.name} />
        </>
      ) : (
        <p className="text-3xl font-bold text-accent">{product.price}</p>
      )}

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
            {product.vendor} hasn&apos;t set its location on the map yet, so we can&apos;t work out how far it is or what the delivery would cost.
          </p>
          <Link href={nearbyHref} className="mt-2 inline-block font-semibold text-accent hover:underline">
            See food near you
          </Link>
        </div>
      ) : (
        <>
          {reach.status === 'FAR' ? (
            <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-ink">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span>{farAwayNote(reach.distanceKm, product.vendor)}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {portions.length > 0 ? (
              <DishPortionOrderButton product={product} className={ORDER_BUTTON_CLASS} />
            ) : (
              <AddToCartButton product={product} className={ORDER_BUTTON_CLASS} />
            )}
            <ChatWidget sellerId={product.sellerId} sellerName={product.vendor} productName={product.name} />
          </div>
        </>
      )}
    </div>
  );

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

          {portions.length > 0 ? <DishPortionsProvider portions={portions}>{details}</DishPortionsProvider> : details}
        </div>
      </div>
    </div>
  );
}
