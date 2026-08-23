'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { MART_CATEGORIES } from '@/lib/data';
import AddToCartButton from './AddToCartButton';

type Product = {
  id: string | number;
  name: string;
  category: string;
  vendor: string;
  sellerId?: string;
  price: string;
  icon: string;
  imageUrl: string | null;
};

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'fastest', label: 'Fastest delivery' },
  { id: 'distance', label: 'Distance' },
  { id: 'top-rated', label: 'Top rated' },
];

const QUICK_FILTERS = [
  { id: 'offers', label: 'Offers' },
  { id: 'vouchers', label: 'Accepts vouchers' },
];

export default function VendorProducts({ products }: { products: Product[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('relevance');
  const [quickFilters, setQuickFilters] = useState<Record<string, boolean>>({});

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const toggleQuickFilter = (id: string) => {
    setQuickFilters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isFiltered =
    searchTerm.trim() !== '' ||
    selectedCategories.length > 0 ||
    sortBy !== 'relevance' ||
    Object.values(quickFilters).some(Boolean);

  const clearFilters = () => {
    setSearchTerm('');
    setCategorySearch('');
    setSelectedCategories([]);
    setSortBy('relevance');
    setQuickFilters({});
  };

  const visibleCategories = MART_CATEGORIES.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    const matchesSearch = normalizedSearch
      ? product.name.toLowerCase().includes(normalizedSearch) ||
        product.vendor.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch)
      : true;

    const matchesCategory =
      selectedCategories.length === 0 || selectedCategories.includes(product.category);

    return matchesSearch && matchesCategory;
  });

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10"
        >
          <div>
            <span className="inline-block px-4 py-2 bg-brand-red-primary/10 text-brand-red-primary rounded-full text-sm font-semibold mb-4">
              MangwaooMart
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-brand-dark mb-4">
              Fresh From Our Vendors
            </h2>
            <p className="text-lg text-brand-gray max-w-xl">
              Groceries and everyday essentials from trusted local shops, ready to order.
            </p>
          </div>
          <Link
            href="/mart"
            className="inline-flex items-center space-x-2 text-brand-red-primary font-semibold hover:underline shrink-0"
          >
            <span>Browse MangwaooMart</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* Filters sidebar */}
          <aside className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0">
            <div className="space-y-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold text-brand-dark">
                  <SlidersHorizontal className="w-4 h-4 text-brand-red-primary" />
                  Filters
                </h3>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-brand-red-primary hover:underline"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-gray">
                  Sort by
                </h4>
                <div className="space-y-2">
                  {SORT_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark"
                    >
                      <input
                        type="radio"
                        name="sortBy"
                        checked={sortBy === option.id}
                        onChange={() => setSortBy(option.id)}
                        className="h-4 w-4 border-gray-300 text-brand-red-primary focus:ring-brand-red-primary"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-gray">
                  Quick filters
                </h4>
                <div className="space-y-2">
                  {QUICK_FILTERS.map((filter) => (
                    <label
                      key={filter.id}
                      className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark"
                    >
                      <input
                        type="checkbox"
                        checked={quickFilters[filter.id] ?? false}
                        onChange={() => toggleQuickFilter(filter.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-red-primary focus:ring-brand-red-primary"
                      />
                      {filter.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-gray">
                  Categories
                </h4>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-brand-gray" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="Search categories"
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                  />
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {visibleCategories.length === 0 ? (
                    <p className="text-xs text-brand-gray">No categories match.</p>
                  ) : (
                    visibleCategories.map((category) => (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-center gap-2 text-sm text-brand-dark"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.name)}
                          onChange={() => toggleCategory(category.name)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-red-primary focus:ring-brand-red-primary"
                        />
                        <span>{category.icon}</span>
                        <span className="truncate">{category.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Products */}
          <div className="min-w-0 flex-1">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 w-4 h-4 -translate-y-1/2 text-brand-gray" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search items, e.g. milk, tomatoes, snacks..."
                className="w-full rounded-full border border-gray-300 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
                <p className="mb-3 text-sm text-brand-gray">No items match your filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-brand-red-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="grid grid-cols-2 gap-6 md:grid-cols-3"
              >
                {filteredProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    variants={itemVariants}
                    whileHover={{ y: -6, transition: { duration: 0.3 } }}
                    className="rounded-2xl bg-brand-light shadow-soft transition-all duration-300 hover:shadow-md"
                  >
                    <Link href={`/mart/${product.id}`} className="flex h-full flex-col p-5">
                      {product.imageUrl ? (
                        <div className="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="mb-3 text-4xl">{product.icon}</div>
                      )}
                      <h3 className="mb-1 text-sm font-semibold text-brand-dark">{product.name}</h3>
                      <p className="mb-3 text-xs text-brand-gray">{product.vendor}</p>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="font-bold text-brand-red-primary">{product.price}</span>
                        <AddToCartButton
                          product={product}
                          className="flex items-center gap-1 rounded-full bg-brand-red-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-red-secondary"
                        />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
