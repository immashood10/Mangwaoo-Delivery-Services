'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Store, PackagePlus, CheckCircle2, Clock, ImagePlus, X, ClipboardList, MapPin, Banknote, Smartphone, Pencil, Trash2, ShoppingCart } from 'lucide-react';
import MessagesInbox from './MessagesInbox';
import EditProductModal from './EditProductModal';

type Category = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  price: number;
  stock: number;
  isActive: boolean;
  category: string;
  images: string[];
};

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  customerName: string;
  address: string;
  addressLabel: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  items: OrderItem[];
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-blue-50 text-blue-700',
  OUT_FOR_DELIVERY: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  WALLET: 'EasyPaisa / JazzCash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES = 6;

type PendingCartItem = {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  price: number;
  updatedAt: string;
};

export default function SellerDashboard({
  businessName,
  ownerName,
  isApproved,
  categories,
  products,
  orders,
  pendingCarts,
}: {
  businessName: string;
  ownerName: string;
  isApproved: boolean;
  categories: Category[];
  products: Product[];
  orders: Order[];
  pendingCarts: PendingCartItem[];
}) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: categories[0]?.id ?? '',
    price: '',
    stock: '',
  });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? It will be removed from MangwaooMart.`)) {
      return;
    }

    setDeletingId(product.id);

    try {
      const response = await fetch(`/api/seller/products/${product.id}`, { method: 'DELETE' });
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

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
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/seller/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          categoryId: form.categoryId,
          price: parseFloat(form.price),
          stock: parseInt(form.stock, 10),
          images: imagePreviews,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setForm({ name: '', description: '', categoryId: categories[0]?.id ?? '', price: '', stock: '' });
      setImagePreviews([]);
      router.refresh();
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-red-primary/10 px-4 py-2 text-sm font-semibold text-brand-red-primary mb-3">
            <Store className="w-4 h-4" />
            Seller Dashboard
          </div>
          <h1 className="text-3xl font-bold text-brand-dark">{businessName}</h1>
          <p className="text-brand-gray">Managed by {ownerName}</p>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            isApproved ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          {isApproved ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          {isApproved ? 'Approved seller' : 'Pending approval'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-1 bg-white rounded-2xl shadow-soft p-6 h-fit"
        >
          <div className="flex items-center gap-2 mb-6">
            <PackagePlus className="w-5 h-5 text-brand-red-primary" />
            <h2 className="text-lg font-bold text-brand-dark">Post a product</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">
                Product name
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Fresh Tomatoes (1 kg)"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Optional details for customers"
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl outline-none transition focus:border-brand-red-primary focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">
                Product photos ({imagePreviews.length}/{MAX_IMAGES})
              </label>
              <div className="flex flex-wrap gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative w-20 h-20">
                    <img
                      src={preview}
                      alt={`Product preview ${index + 1}`}
                      className="w-20 h-20 rounded-xl object-cover border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImagePreview(index)}
                      className="absolute -right-2 -top-2 rounded-full bg-white border border-gray-200 p-1 text-brand-gray hover:text-brand-red-primary"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {imagePreviews.length < MAX_IMAGES && (
                  <label className="flex items-center justify-center gap-2 w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 text-brand-gray cursor-pointer hover:border-brand-red-primary hover:text-brand-red-primary transition-colors">
                    <ImagePlus className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-brand-dark mb-2">
                Category
              </label>
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
                <label className="block text-sm font-semibold text-brand-dark mb-2">
                  Price (PKR)
                </label>
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
                <label className="block text-sm font-semibold text-brand-dark mb-2">
                  Stock
                </label>
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

            <button
              type="submit"
              disabled={isSubmitting || categories.length === 0}
              className="w-full bg-gradient-to-r from-brand-red-primary to-brand-red-secondary text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Posting…' : 'Post product'}
            </button>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-2xl shadow-soft p-6"
        >
          <h2 className="text-lg font-bold text-brand-dark mb-6">Your products</h2>

          {products.length === 0 ? (
            <p className="text-brand-gray text-sm">
              You haven&apos;t posted any products yet. Add your first one to see it live on MangwaooMart.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-brand-gray border-b border-gray-100">
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
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-brand-light" />
                        )}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-brand-dark">{product.name}</td>
                      <td className="py-3 pr-4 text-brand-gray">{product.category}</td>
                      <td className="py-3 pr-4 text-brand-red-primary font-semibold">
                        PKR {product.price.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-brand-gray">{product.stock}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingProduct(product)}
                            className="rounded-lg border border-gray-200 p-1.5 text-brand-dark hover:border-brand-red-primary hover:text-brand-red-primary"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            disabled={deletingId === product.id}
                            className="rounded-lg border border-gray-200 p-1.5 text-brand-dark hover:border-red-600 hover:text-red-600 disabled:opacity-50"
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
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="mt-8 bg-white rounded-2xl shadow-soft p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <ShoppingCart className="w-5 h-5 text-brand-red-primary" />
          <h2 className="text-lg font-bold text-brand-dark">Pending — still in cart</h2>
        </div>

        {pendingCarts.length === 0 ? (
          <p className="text-brand-gray text-sm">
            No pending carts right now. Items customers add to cart but haven&apos;t ordered yet will show up here.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingCarts.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-dark">
                    {item.productName} <span className="text-brand-gray">x{item.quantity}</span>
                  </p>
                  <p className="text-xs text-brand-gray">
                    {item.customerName} &middot;{' '}
                    {new Date(item.updatedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                  Pending
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-8 bg-white rounded-2xl shadow-soft p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <ClipboardList className="w-5 h-5 text-brand-red-primary" />
          <h2 className="text-lg font-bold text-brand-dark">Incoming orders</h2>
        </div>

        {orders.length === 0 ? (
          <p className="text-brand-gray text-sm">
            No orders yet. Orders customers place for your products will show up here.
          </p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-dark">
                      Order #{order.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-brand-gray">
                      {order.customerName} &middot;{' '}
                      {new Date(order.createdAt).toLocaleString('en-PK', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      ORDER_STATUS_STYLES[order.status] ?? 'bg-gray-50 text-brand-gray'
                    }`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-start gap-2 text-xs text-brand-gray mb-3">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{order.address}</span>
                </div>

                <ul className="text-sm text-brand-dark space-y-1 mb-3">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between">
                      <span>
                        {item.productName} <span className="text-brand-gray">x{item.quantity}</span>
                      </span>
                      <span className="text-brand-gray">
                        PKR {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-brand-gray">
                    {order.paymentMethod === 'CASH_ON_DELIVERY' ? (
                      <Banknote className="w-3.5 h-3.5" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5" />
                    )}
                    {order.paymentMethod ? PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod : 'N/A'}
                    {order.paymentStatus ? ` · ${order.paymentStatus}` : ''}
                  </span>
                  <span className="font-bold text-brand-red-primary">
                    PKR {order.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <div className="mt-8">
        <MessagesInbox currentRole="SELLER" />
      </div>

      {editingProduct && (
        <EditProductModal
          apiBasePath="/api/seller/products"
          categories={categories}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
