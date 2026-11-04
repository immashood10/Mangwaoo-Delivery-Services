import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';
import { getSession } from '@/lib/auth';
import { getOfficialSeller } from '@/lib/official-store';
import { getSellerCategories, getSellerProducts } from '@/lib/seller-data';
import AdminStoreSetup from '@/components/AdminStoreSetup';
import PostProductForm from '@/components/seller/PostProductForm';
import ProductsTable from '@/components/seller/ProductsTable';

export const metadata = {
  title: 'Mangwaoo Store - Mangwaoo Admin',
};

export default async function AdminStorePage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const store = await getOfficialSeller();
  const [categories, products] = store ? await Promise.all([getSellerCategories(store), getSellerProducts(store)]) : [[], []];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-accent">
        <ShoppingBag className="h-4 w-4" />
        Admin
      </div>
      <h1 className="mb-2 text-3xl font-bold text-ink">Mangwaoo Store</h1>
      <p className="mb-8 max-w-3xl text-brand-gray">
        Mangwaoo&apos;s own products in MangwaooMart. Customers see them under the name &ldquo;Mangwaoo&rdquo; like any vendor and order them
        the normal way. Nobody logs in as this store: you post and edit here, and the orders are handled by you (
        <Link href="/admin/orders" className="font-semibold text-accent underline">
          Orders
        </Link>
        ) and the area managers.
      </p>

      {store ? (
        <div className="space-y-10">
          <section id="post-product" aria-labelledby="post-heading" className="scroll-mt-24">
            <h2 id="post-heading" className="mb-4 text-xl font-bold text-ink">
              Post a product
            </h2>
            <PostProductForm marketplace="MART" categories={categories} asStore />
          </section>

          <section id="our-products" aria-labelledby="products-heading" className="scroll-mt-24">
            <h2 id="products-heading" className="mb-4 text-xl font-bold text-ink">
              Our products ({products.length})
            </h2>
            <ProductsTable marketplace="MART" categories={categories} products={products} asStore />
          </section>
        </div>
      ) : (
        <AdminStoreSetup />
      )}
    </div>
  );
}
