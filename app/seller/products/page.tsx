import { Package } from 'lucide-react';
import ProductsTable from '@/components/seller/ProductsTable';
import SellerPageHeader from '@/components/seller/SellerPageHeader';
import { requireSeller } from '@/lib/seller-context';
import { getSellerCategories, getSellerProducts, sellerMarketplace } from '@/lib/seller-data';

export default async function SellerProductsPage() {
  const seller = await requireSeller();
  const [products, categories] = await Promise.all([getSellerProducts(seller), getSellerCategories(seller)]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <SellerPageHeader
        icon={Package}
        title="Your products"
        description={`${products.length} ${products.length === 1 ? 'product' : 'products'} listed. Edit a product or delete it to take it off the website.`}
      />

      <ProductsTable marketplace={sellerMarketplace(seller)} categories={categories} products={products} />
    </div>
  );
}
