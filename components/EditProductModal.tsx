'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, X } from 'lucide-react';

type Category = { id: string; name: string };

type EditableProduct = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  price: number;
  stock: number;
  images: string[];
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 6;

export default function EditProductModal({
  apiBasePath,
  categories,
  product,
  onClose,
  onSaved,
}: {
  apiBasePath: string;
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
  const [images, setImages] = useState<string[]>(product.images);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBasePath}/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          price: parseFloat(form.price),
          stock: parseInt(form.stock, 10),
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
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-brand-dark">Edit product</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-brand-dark hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-2">Product name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-2">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-2">
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
                    className="absolute -right-2 -top-2 rounded-full bg-white border border-gray-200 p-1 text-brand-gray hover:text-brand-red-primary"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="flex items-center justify-center gap-2 w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 text-brand-gray cursor-pointer hover:border-brand-red-primary hover:text-brand-red-primary transition-colors">
                  <ImagePlus className="w-5 h-5" />
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-brand-dark mb-2">Category</label>
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Price (PKR)</label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                min="1"
                step="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">Stock</label>
              <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                min="0"
                step="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                required
              />
            </div>
          </div>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-brand-dark hover:bg-gray-50"
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
