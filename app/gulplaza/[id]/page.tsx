import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { GULPLAZA_CATEGORIES } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import AddToCartButton from '@/components/AddToCartButton';
import ChatWidget from '@/components/ChatWidget';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  GULPLAZA_CATEGORIES.map((category) => [category.name, category.icon])
);

export default async function GulplazaProductDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  return (
    <div className="w-full py-12 md:py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/gulplaza"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-red-primary hover:underline mb-8"
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
            <span className="inline-block px-3 py-1 bg-brand-red-primary/10 text-brand-red-primary rounded-full text-xs font-semibold">
              {product.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-brand-dark">{product.name}</h1>
            <p className="text-sm text-brand-gray">Sold by {product.vendor}</p>
            <p className="text-3xl font-bold text-brand-red-primary">{product.price}</p>

            <p className={`text-sm font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {product.stock > 0 ? `In stock (${product.stock} available)` : 'Out of stock'}
            </p>

            <div>
              <h2 className="text-sm font-bold text-brand-dark mb-2">Description</h2>
              <p className="text-brand-gray leading-relaxed">{product.description}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <AddToCartButton
                product={product}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-8 py-3 text-sm font-semibold text-white hover:shadow-lg transition-all duration-300"
              />
              <ChatWidget sellerId={product.sellerId} sellerName={product.vendor} productName={product.name} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
