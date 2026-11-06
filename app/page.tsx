import Link from 'next/link';
import { Utensils, Play, ShoppingBag, Store } from 'lucide-react';
import FoodReels from '@/components/reels/FoodReels';
import RestaurantsSection from '@/components/RestaurantsSection';
import HomeCollection from '@/components/HomeCollection';
import { FOOD_FIRST_HOME as copy } from '@/lib/data';
import { getMartProducts } from '@/lib/products';
import { isEssentialCategory } from '@/lib/marketplace-sections';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const products = await getMartProducts();
  const items = (essentials: boolean) => products.filter(p => isEssentialCategory(p.category.name) === essentials).slice(0, 4).map(p => ({ id: p.id, name: p.name, price: Number(p.price), image: p.images[0] || null, vendor: p.seller.businessName }));
  return <div><section className="bg-brand-light"><div className="mx-auto max-w-6xl px-4 pb-12 pt-10 md:pt-16"><p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-accent"><Utensils size={15}/>{copy.eyebrow}</p><h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-ink md:text-6xl">{copy.title}</h1><p className="mt-5 max-w-xl text-base leading-7 text-brand-gray">{copy.description}</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/gulplaza" className="inline-flex items-center gap-2 rounded-full bg-brand-red-primary px-6 py-3 text-sm font-bold text-white"><Utensils size={18}/>{copy.foodAction}</Link><Link href="/reels" className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-surface px-6 py-3 text-sm font-bold text-accent"><Play size={18}/>{copy.reelsAction}</Link></div><nav aria-label="Explore Mangwaoo" className="mt-8 flex flex-wrap gap-3"><Link href="/gulplaza" className="rounded-2xl border border-accent/20 bg-surface px-4 py-3 text-sm font-semibold text-accent">Food</Link><Link href="/shopping" className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-gray"><ShoppingBag size={17}/>Online shopping</Link><Link href="/mart" className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-brand-gray"><Store size={17}/>MangwaooMart</Link></nav></div></section><RestaurantsSection/><FoodReels/><HomeCollection title={copy.shoppingTitle} description={copy.shoppingDescription} href="/shopping" items={items(false)}/><HomeCollection title={copy.martTitle} description={copy.martDescription} href="/mart" items={items(true)}/></div>;
}
