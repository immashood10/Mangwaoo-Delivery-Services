import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MART_CATEGORIES, MART_PRODUCTS } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { formatAdDate, formatMonthYear, getRelatedAds } from '@/lib/ads';
import { formatLocation } from '@/lib/locations';
import AddToCartButton from '@/components/AddToCartButton';
import AdCard from '@/components/AdCard';
import ChatWidget from '@/components/ChatWidget';
import LikeButton from '@/components/LikeButton';
import SafetyTips from '@/components/SafetyTips';
import SellerCard from '@/components/SellerCard';
import ShareButton from '@/components/ShareButton';
import SizeList from '@/components/SizeList';
import VehicleDetailsList from '@/components/VehicleDetailsList';
import { parseSizeDetails } from '@/lib/size-options';
import { isVehicleCategory, parseVehicleDetails } from '@/lib/vehicle-details';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  MART_CATEGORIES.map((category) => [category.name, category.icon])
);

// generateMetadata and the page both need the ad; cache() shares one query between them.
const getAd = cache((id: string) =>
  prisma.product.findFirst({
    where: { id, isActive: true },
    include: { category: true, seller: true },
  })
);

function formatPrice(price: unknown) {
  return `PKR ${Number(price).toLocaleString()}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ad = await getAd(id);

  if (!ad) return {};

  // Shared links (WhatsApp, Telegram…) need absolute URLs for the preview picture.
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  const title = `${ad.name} - ${formatPrice(ad.price)}`;
  const description =
    ad.description?.trim() || `${ad.category.name} from ${ad.seller.businessName}, available on MangwaooMart.`;

  return {
    ...(host ? { metadataBase: new URL(`${protocol}://${host}`) } : {}),
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      ...(ad.images.length > 0 ? { images: [`/api/products/${ad.id}/image`] } : {}),
    },
  };
}

export default async function MartProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [dbProduct, session] = await Promise.all([getAd(id), getSession()]);

  const product = dbProduct
    ? {
        id: dbProduct.id,
        name: dbProduct.name,
        category: dbProduct.category.name,
        vendor: dbProduct.seller.businessName,
        sellerId: dbProduct.sellerId,
        price: formatPrice(dbProduct.price),
        icon: CATEGORY_ICONS[dbProduct.category.name] ?? '🛍️',
        imageUrl: dbProduct.images[0] ?? null,
        description:
          dbProduct.description?.trim() ||
          `${dbProduct.category.name} from ${dbProduct.seller.businessName}, available on MangwaooMart.`,
        stock: dbProduct.stock,
        vehicleDetails: parseVehicleDetails(dbProduct.attributes),
        sizeDetails: parseSizeDetails(dbProduct.attributes),
      }
    : (() => {
        const demo = MART_PRODUCTS.find((item) => String(item.id) === id);
        if (!demo) return null;
        return {
          id: demo.id,
          name: demo.name,
          category: demo.category,
          vendor: demo.vendor,
          sellerId: undefined as string | undefined,
          price: demo.price,
          icon: demo.icon,
          imageUrl: null as string | null,
          description: `${demo.category} from ${demo.vendor}, available on MangwaooMart.`,
          stock: null as number | null,
          vehicleDetails: null as ReturnType<typeof parseVehicleDetails>,
          sizeDetails: null as ReturnType<typeof parseSizeDetails>,
        };
      })();

  if (!product) {
    notFound();
  }

  // Everything the page shows around the ad itself (seller, likes, related ads) is
  // fetched together, so the remote DB is hit once in parallel rather than one by one.
  const community = dbProduct
    ? await Promise.all([
        prisma.product.count({ where: { sellerId: dbProduct.sellerId, isActive: true } }),
        prisma.productLike.count({ where: { productId: dbProduct.id } }),
        session
          ? prisma.productLike.count({ where: { productId: dbProduct.id, userId: session.userId } })
          : Promise.resolve(0),
        getRelatedAds(dbProduct.id, dbProduct.categoryId),
      ]).then(([activeAds, likeCount, likedByMe, relatedAds]) => ({
        activeAds,
        likeCount,
        liked: likedByMe > 0,
        relatedAds,
      }))
    : null;

  const isVehicleAd = isVehicleCategory(product.category);

  return (
    <div className="w-full py-12 md:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/mart"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to MangwaooMart
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          <div className="rounded-3xl bg-brand-light flex items-center justify-center overflow-hidden aspect-square md:sticky md:top-24">
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
              <div className="flex items-center gap-2">
                {community && dbProduct ? (
                  <LikeButton
                    productId={dbProduct.id}
                    initialLiked={community.liked}
                    initialCount={community.likeCount}
                  />
                ) : null}
                <ShareButton
                  path={dbProduct ? `/mart/${dbProduct.id}` : `/mart/${product.id}`}
                  title={product.name}
                  text={`${product.name} - ${product.price} on MangwaooMart`}
                />
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-ink">{product.name}</h1>

            {dbProduct ? (
              <p className="text-xs text-brand-gray">
                Ad ID: <span className="font-semibold text-ink">{dbProduct.adNumber}</span>
                <span aria-hidden="true"> · </span>
                Posted {formatAdDate(dbProduct.createdAt)}
              </p>
            ) : null}

            <p className="text-sm text-brand-gray">
              Sold by{' '}
              {product.sellerId ? (
                <Link href={`/store/${product.sellerId}`} className="font-semibold text-accent hover:underline">
                  {product.vendor}
                </Link>
              ) : (
                product.vendor
              )}
            </p>
            <p className="text-3xl font-bold text-accent">{product.price}</p>

            {product.stock !== null && (
              <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-success' : 'text-danger'}`}>
                {product.stock > 0 ? `In stock (${product.stock} available)` : 'Out of stock'}
              </p>
            )}

            <div>
              <h2 className="text-sm font-bold text-ink mb-2">Description</h2>
              <p className="text-brand-gray leading-relaxed">{product.description}</p>
            </div>

            {product.vehicleDetails ? <VehicleDetailsList details={product.vehicleDetails} /> : null}

            {product.sizeDetails ? <SizeList details={product.sizeDetails} /> : null}

            <div className="flex flex-wrap gap-3">
              <AddToCartButton
                product={product}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-8 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
              />
              {product.sellerId && (
                <ChatWidget sellerId={product.sellerId} sellerName={product.vendor} productName={product.name} />
              )}
            </div>

            {dbProduct && community ? (
              <SellerCard
                sellerId={dbProduct.sellerId}
                storeName={dbProduct.seller.businessName}
                location={formatLocation(dbProduct.seller.city, dbProduct.seller.country)}
                memberSince={formatMonthYear(dbProduct.seller.createdAt)}
                activeAds={community.activeAds}
              />
            ) : null}

            {isVehicleAd ? <SafetyTips /> : null}
          </div>
        </div>

        {community && community.relatedAds.length > 0 ? (
          <section aria-labelledby="related-ads-heading" className="mt-16">
            <h2 id="related-ads-heading" className="mb-5 text-xl font-bold text-ink">
              Related ads
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {community.relatedAds.map((ad) => (
                <AdCard key={ad.id} ad={ad} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
