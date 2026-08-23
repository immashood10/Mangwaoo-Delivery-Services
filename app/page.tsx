import Hero from '@/components/Hero';
import VendorProducts from '@/components/VendorProducts';
import ServicesSection from '@/components/ServicesSection';
import WhyChooseUs from '@/components/WhyChooseUs';
import { MART_CATEGORIES, MART_PRODUCTS } from '@/lib/data';
import { getMartProducts } from '@/lib/products';

const CATEGORY_ICONS: Record<string, string> = Object.fromEntries(
  MART_CATEGORIES.map((category) => [category.name, category.icon])
);

// Regenerates the static page (not just the underlying data cache) on this
// interval so newly listed products actually reach the rendered HTML.
export const revalidate = 300;

export default async function Home() {
  const sellerProducts = (await getMartProducts()).slice(0, 12);

  const products = [
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
  ].slice(0, 12);

  return (
    <div className="w-full">
      <Hero />
      <VendorProducts products={products} />
      <ServicesSection />
      <WhyChooseUs />
    </div>
  );
}
