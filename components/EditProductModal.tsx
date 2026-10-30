'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, X } from 'lucide-react';
import SizeFields from './SizeFields';
import VehicleDetailsFields from './VehicleDetailsFields';
import PortionFields, { portionRowsFrom, portionsFromRows, type PortionRow } from './seller/PortionFields';
import FoodMetadataFields from './seller/FoodMetadataFields';
import type { Portion } from '@/lib/food-portions';
import type { FoodDishTag, FoodSpiceLevelKey } from '@/lib/food-ai-metadata';
import {
  emptySizeDetails,
  getSizeOptions,
  isSizedCategory,
  type SizeDetails,
} from '@/lib/size-options';
import {
  emptyVehicleDetails,
  isVehicleCategory,
  parseVehicleDetails,
  type VehicleDetails,
  type VehicleFieldKey,
} from '@/lib/vehicle-details';

type Category = { id: string; name: string };

type EditableProduct = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  price: number;
  stock: number;
  images: string[];
  /** Vehicle ads only (Mart): make, model, year, … */
  attributes?: unknown;
  /** Clothes and shoes only (Mart): the sizes on offer. */
  sizes?: SizeDetails | null;
  /** Food dishes sold by weight only: the sizes (250 g, 500 g, 1 kg ...) with a price each. */
  portions?: Portion[];
  spiceLevel?: FoodSpiceLevelKey | null;
  dishTags?: FoodDishTag[];
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 6;

export default function EditProductModal({
  apiBasePath,
  enableVehicleDetails = false,
  enableSizes = false,
  enablePortions = false,
  hideStock = false,
  categories,
  product,
  onClose,
  onSaved,
}: {
  apiBasePath: string;
  /** Show the vehicle detail fields when the "Vehicles" category is selected (MangwaooMart only). */
  enableVehicleDetails?: boolean;
  /** Ask for sizes when a clothes/shoes category (Men, Women, Kids) is selected (MangwaooMart only). */
  enableSizes?: boolean;
  /** Let a food dish be sold by weight: sizes like 250 g, 500 g, 1 kg with a price each (Food only). */
  enablePortions?: boolean;
  /** Food dishes have no stock count (`lib/food-stock.ts`). */
  hideStock?: boolean;
  categories: Category[];
  product: EditableProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? '',
    categoryId: product.categoryId,
    price: String(product.price),
    stock: String(product.stock),
  });
  const [vehicle, setVehicle] = useState<VehicleDetails>(
    () => parseVehicleDetails(product.attributes) ?? emptyVehicleDetails()
  );
  const [sizes, setSizes] = useState<SizeDetails>(() => product.sizes ?? emptySizeDetails());
  const [byWeight, setByWeight] = useState(() => enablePortions && (product.portions?.length ?? 0) > 0);
  const [portionRows, setPortionRows] = useState<PortionRow[]>(() => portionRowsFrom(product.portions ?? []));
  const [spiceLevel, setSpiceLevel] = useState<FoodSpiceLevelKey | null>(product.spiceLevel ?? null);
  const [dishTags, setDishTags] = useState<FoodDishTag[]>(product.dishTags ?? []);
  const [images, setImages] = useState<string[]>(product.images);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCategoryName = categories.find((category) => category.id === form.categoryId)?.name;
  const isVehicleAd = enableVehicleDetails && isVehicleCategory(selectedCategoryName);
  const isSizedAd = enableSizes && isSizedCategory(selectedCategoryName);

  const handleVehicleChange = (key: VehicleFieldKey, value: string) => {
    setVehicle((prev) => ({ ...prev, [key]: value }));
  };

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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
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
      reader.onload = () => setImages((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (isSizedAd && sizes.sizeType !== 'none' && sizes.sizes.length === 0) {
      setFormError('Please choose at least one size, or pick "Something else (no sizes)".');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBasePath}/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          // A dish sold by weight is priced by its sizes (the server takes the lowest as the dish's own price).
          ...(enablePortions && byWeight ? {} : { price: parseFloat(form.price) }),
          ...(enablePortions ? { portions: byWeight ? portionsFromRows(portionRows) : [] } : {}),
          ...(enablePortions ? { spiceLevel, dishTags } : {}),
          ...(hideStock ? {} : { stock: parseInt(form.stock, 10) }),
          ...(isVehicleAd ? { attributes: vehicle } : {}),
          ...(isSizedAd ? { attributes: sizes } : {}),
          images,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      onSaved();
      onClose();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-ink">Edit product</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-ink hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Product name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Product photos ({images.length}/{MAX_IMAGES})
            </label>
            <div className="flex flex-wrap gap-3">
              {images.map((preview, index) => (
                <div key={index} className="relative w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={`Product preview ${index + 1}`}
                    className="w-20 h-20 rounded-xl object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -right-2 -top-2 rounded-full bg-surface border border-gray-200 p-1 text-brand-gray hover:text-accent"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="flex items-center justify-center gap-2 w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 text-brand-gray cursor-pointer hover:border-accent hover:text-accent transition-colors">
                  <ImagePlus className="w-5 h-5" />
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Category</label>
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
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
            <VehicleDetailsFields values={vehicle} onChange={handleVehicleChange} idPrefix="edit-vehicle" columns={2} />
          ) : null}

          {isSizedAd ? (
            <SizeFields categoryName={selectedCategoryName} value={sizes} onChange={setSizes} idPrefix="edit-size" />
          ) : null}

          {enablePortions ? (
            <>
            <FoodMetadataFields idPrefix="edit-food" spiceLevel={spiceLevel} dishTags={dishTags} onSpiceChange={setSpiceLevel} onTagsChange={setDishTags} />
            <PortionFields
              enabled={byWeight}
              onEnabledChange={setByWeight}
              rows={portionRows}
              onRowsChange={setPortionRows}
              idPrefix="edit-portion"
            />
            </>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            {enablePortions && byWeight ? null : (
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Price (PKR)</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                min="1"
                step="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                required
              />
            </div>
            )}
            {hideStock ? null : (
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Stock</label>
              <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100"
                required
              />
            </div>
            )}
          </div>

          {formError ? <p className="text-sm text-danger">{formError}</p> : null}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-ink hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
