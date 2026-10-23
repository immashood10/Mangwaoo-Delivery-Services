'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ImagePlus, X } from 'lucide-react';
import SizeFields from '@/components/SizeFields';
import VehicleDetailsFields from '@/components/VehicleDetailsFields';
import { SELLER_PAGES } from '@/lib/notification-types';
import type { Marketplace, SellerCategory } from '@/lib/seller-types';
import {
  emptySizeDetails,
  getSizeOptions,
  isSizedCategory,
  type SizeDetails,
} from '@/lib/size-options';
import {
  emptyVehicleDetails,
  isVehicleCategory,
  type VehicleDetails,
  type VehicleFieldKey,
} from '@/lib/vehicle-details';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 6;

const INPUT_CLASS =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-transparent outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100';

/** The "Post product" form. MangwaooMart sellers can also post vehicle ads; food sellers post to Food. */
export default function PostProductForm({
  marketplace,
  categories,
}: {
  marketplace: Marketplace;
  categories: SellerCategory[];
}) {
  const router = useRouter();
  const isMart = marketplace === 'MART';

  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: categories[0]?.id ?? '',
    price: '',
    stock: '',
  });
  const [vehicle, setVehicle] = useState<VehicleDetails>(emptyVehicleDetails);
  const [sizes, setSizes] = useState<SizeDetails>(emptySizeDetails);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [postedName, setPostedName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategoryName = categories.find((category) => category.id === form.categoryId)?.name;
  const isVehicleAd = isMart && isVehicleCategory(selectedCategoryName);
  const isSizedAd = isMart && isSizedCategory(selectedCategoryName);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === 'categoryId') {
      // Kids' sizes differ from Men's and Women's: keep only the picks that still exist.
      const nextCategoryName = categories.find((category) => category.id === value)?.name;
      setSizes((prev) => {
        const valid = getSizeOptions(nextCategoryName, prev.sizeType);
        return { ...prev, sizes: prev.sizes.filter((size) => valid.includes(size)) };
      });
    }
  };

  const handleVehicleChange = (key: VehicleFieldKey, value: string) => {
    setVehicle((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) return;

    if (imagePreviews.length + files.length > MAX_IMAGES) {
      setFormError(`You can upload up to ${MAX_IMAGES} photos per product.`);
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setFormError('Please choose image files only.');
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        setFormError('Each image must be smaller than 2 MB.');
        return;
      }
    }

    setFormError('');
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeImagePreview = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setPostedName('');

    if (isSizedAd && sizes.sizeType !== 'none' && sizes.sizes.length === 0) {
      setFormError('Please choose at least one size, or pick "Something else (no sizes)".');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(isMart ? '/api/seller/products' : '/api/seller/gulplaza-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          price: parseFloat(form.price),
          // A vehicle ad is a single item, so it has no stock count to enter; food has none at all.
          ...(isMart ? { stock: isVehicleAd ? 1 : parseInt(form.stock, 10) } : {}),
          images: imagePreviews,
          ...(isVehicleAd ? { attributes: vehicle } : {}),
          ...(isSizedAd ? { attributes: sizes } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setPostedName(form.name);
      setForm({ name: '', description: '', categoryId: categories[0]?.id ?? '', price: '', stock: '' });
      setVehicle(emptyVehicleDetails());
      setSizes(emptySizeDetails());
      setImagePreviews([]);
      router.refresh();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded-2xl bg-surface p-6 shadow-soft md:p-8">
      {postedName ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-semibold">&ldquo;{postedName}&rdquo; is posted.</span>
          <Link href={SELLER_PAGES.products} className="font-semibold underline">
            See it in Your products
          </Link>
        </div>
      ) : null}

      <div>
        <label htmlFor="post-name" className="block text-sm font-semibold text-ink mb-2">
          {isVehicleAd ? 'Ad title' : 'Product name'}
        </label>
        <input
          id="post-name"
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder={
            isVehicleAd
              ? 'e.g. Yamaha YZF-R1 2022 – Karachi'
              : isMart
                ? 'e.g. Fresh Tomatoes (1 kg)'
                : 'e.g. Chicken Zinger Burger'
          }
          className={INPUT_CLASS}
          required
        />
      </div>

      <div>
        <label htmlFor="post-description" className="block text-sm font-semibold text-ink mb-2">
          Description
        </label>
        <textarea
          id="post-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Optional details for customers"
          rows={3}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <span className="block text-sm font-semibold text-ink mb-2">
          Photos ({imagePreviews.length}/{MAX_IMAGES})
        </span>
        <div className="flex flex-wrap gap-3">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative w-20 h-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={`Product preview ${index + 1}`}
                className="w-20 h-20 rounded-xl object-cover border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removeImagePreview(index)}
                className="absolute -right-2 -top-2 rounded-full bg-surface border border-gray-200 p-1 text-brand-gray hover:text-accent"
                aria-label={`Remove photo ${index + 1}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {imagePreviews.length < MAX_IMAGES && (
            <label className="flex items-center justify-center gap-2 w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 text-brand-gray cursor-pointer hover:border-accent hover:text-accent transition-colors">
              <ImagePlus className="w-5 h-5" />
              <span className="sr-only">Add photos</span>
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="post-category" className="block text-sm font-semibold text-ink mb-2">
          Category
        </label>
        <select
          id="post-category"
          name="categoryId"
          value={form.categoryId}
          onChange={handleChange}
          className={INPUT_CLASS}
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {isVehicleAd ? (
        <VehicleDetailsFields values={vehicle} onChange={handleVehicleChange} idPrefix="post-vehicle" columns={2} />
      ) : null}

      {isSizedAd ? (
        <SizeFields categoryName={selectedCategoryName} value={sizes} onChange={setSizes} idPrefix="post-size" />
      ) : null}

      <div className={isVehicleAd ? '' : 'grid grid-cols-1 gap-4 sm:grid-cols-2'}>
        <div>
          <label htmlFor="post-price" className="block text-sm font-semibold text-ink mb-2">
            Price (PKR)
          </label>
          <input
            id="post-price"
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            min="1"
            step="1"
            className={INPUT_CLASS}
            required
          />
        </div>
        {isVehicleAd || !isMart ? null : (
          <div>
            <label htmlFor="post-stock" className="block text-sm font-semibold text-ink mb-2">
              Stock
            </label>
            <input
              id="post-stock"
              type="number"
              name="stock"
              value={form.stock}
              onChange={handleChange}
              min="0"
              step="1"
              className={INPUT_CLASS}
              required
            />
          </div>
        )}
      </div>

      {formError ? <p className="text-sm text-danger">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || categories.length === 0}
        className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Posting…' : isVehicleAd ? 'Post ad' : 'Post product'}
      </button>
    </form>
  );
}
