'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, PackagePlus, Pencil, Trash2 } from 'lucide-react';
import EditProductModal from '@/components/EditProductModal';
import { SELLER_PAGES } from '@/lib/notification-types';
import type { Marketplace, SellerCategory, SellerProduct } from '@/lib/seller-types';
import { useServerRefresh } from './useServerRefresh';

/** Every product the seller has listed, with edit and delete. */
export default function ProductsTable({
  marketplace,
  categories,
  products: allProducts,
}: {
  marketplace: Marketplace;
  categories: SellerCategory[];
  products: SellerProduct[];
}) {
  const { refresh } = useServerRefresh();
  const isMart = marketplace === 'MART';
  const apiBasePath = isMart ? '/api/seller/products' : '/api/seller/gulplaza-products';
  const catalogName = isMart ? 'MangwaooMart' : 'Food';

  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // A deleted product disappears at once; the refreshed list from the server then replaces this guess.
  const [source, setSource] = useState(allProducts);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  if (allProducts !== source) {
    setSource(allProducts);
    setRemovedIds([]);
  }
  const products = allProducts.filter((product) => !removedIds.includes(product.id));

  const handleDelete = async (product: SellerProduct) => {
    if (!window.confirm(`Delete "${product.name}"? It will be removed from ${catalogName}.`)) {
      return;
    }

    setDeletingId(product.id);
    setError('');
    // Hide it straight away; put it back if the server says no.
    setRemovedIds((current) => [...current, product.id]);

    try {
      const response = await fetch(`${apiBasePath}/${product.id}`, { method: 'DELETE' });

      if (response.ok) {
        refresh();
      } else {
        setRemovedIds((current) => current.filter((id) => id !== product.id));
        setError('Could not delete that product. Please try again.');
      }
    } catch {
      setRemovedIds((current) => current.filter((id) => id !== product.id));
      setError('Could not reach the server. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (products.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
        <p className="mb-4 text-sm text-brand-gray">
          You haven&apos;t posted any products yet. Add your first one to see it live on {catalogName}.
        </p>
        <Link
          href={SELLER_PAGES.post}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
        >
          <PackagePlus className="h-4 w-4" />
          Post your first product
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-surface p-4 shadow-soft md:p-6">
        {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-brand-gray">
                <th className="py-2 pr-4 font-semibold">Image</th>
                <th className="py-2 pr-4 font-semibold">Product</th>
                <th className="py-2 pr-4 font-semibold">Category</th>
                <th className="py-2 pr-4 font-semibold">Price</th>
                <th className="py-2 pr-4 font-semibold">Stock</th>
                <th className="py-2 pr-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 pr-4">
                    {product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-brand-light" />
                    )}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-ink">{product.name}</td>
                  <td className="py-3 pr-4 text-brand-gray">{product.category}</td>
                  <td className="py-3 pr-4 font-semibold text-accent">PKR {product.price.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-brand-gray">{product.stock}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={isMart ? `/mart/${product.id}` : `/gulplaza/${product.id}`}
                        className="rounded-lg border border-gray-200 p-1.5 text-ink hover:border-accent hover:text-accent"
                        aria-label={`View ${product.name} on the website`}
                      >
                        <ExternalLink size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(product)}
                        className="rounded-lg border border-gray-200 p-1.5 text-ink hover:border-accent hover:text-accent"
                        aria-label={`Edit ${product.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        disabled={deletingId === product.id}
                        className="rounded-lg border border-gray-200 p-1.5 text-ink hover:border-red-600 hover:text-danger disabled:opacity-50"
                        aria-label={`Delete ${product.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingProduct && (
        <EditProductModal
          apiBasePath={apiBasePath}
          enableVehicleDetails={isMart}
          enableSizes={isMart}
          categories={categories}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
