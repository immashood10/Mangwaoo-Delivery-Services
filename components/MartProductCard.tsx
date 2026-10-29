import Link from 'next/link';
import AddToCartButton from '@/components/AddToCartButton';
import type { CartProduct } from '@/lib/cart-context';

/** A product as the MangwaooMart listings show it: what the cart needs, plus its category and first picture. */
export type MartCardProduct = CartProduct & { category: string; imageUrl: string | null };

/**
 * One product tile of a MangwaooMart listing (the Mart page and the Sports page): the picture (or the category's icon), the
 * name, the vendor, the price and the Order button. The whole tile opens the product's page.
 */
export default function MartProductCard({ product }: { product: MartCardProduct }) {
  return (
    <div className="bg-surface rounded-2xl shadow-soft hover:shadow-md transition-all duration-300">
      <Link href={`/mart/${product.id}`} className="flex h-full flex-col p-5">
        {product.imageUrl ? (
          <div className="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-brand-light">
            {/* A seller's own photo (a data: URL or another host): next/image is not used for these anywhere in the shop. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain" />
          </div>
        ) : (
          <div className="text-4xl mb-3">{product.icon}</div>
        )}
        <h3 className="font-semibold text-ink text-sm mb-1">{product.name}</h3>
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
  );
}
