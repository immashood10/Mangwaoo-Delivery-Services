import HomeCollection from '@/components/HomeCollection';
import { getMartProducts } from '@/lib/products';
import { isEssentialCategory } from '@/lib/marketplace-sections';
import { FOOD_FIRST_HOME } from '@/lib/data';
export const dynamic = 'force-dynamic';
export default async function ShoppingPage() {
  const products = await getMartProducts();
  return <HomeCollection title={FOOD_FIRST_HOME.shoppingTitle} description={FOOD_FIRST_HOME.shoppingDescription} href="/mart" items={products.filter(p => !isEssentialCategory(p.category.name)).map(p => ({ id: p.id, name: p.name, price: Number(p.price), image: p.images[0] || null, vendor: p.seller.businessName }))}/>;
}
