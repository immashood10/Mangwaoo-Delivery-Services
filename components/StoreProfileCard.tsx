'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, MapPin, Pencil, Store, Tag } from 'lucide-react';
import LocationPicker, { type PickedLocation } from '@/components/LocationPicker';
import { DEFAULT_COUNTRY, MAX_PLACE_LENGTH, PAKISTAN_CITIES, formatLocation } from '@/lib/locations';

const INPUT_CLASS =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-transparent outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100';

/** The seller's public store: name and location (editable), active ads, and a link to the page buyers see. */
export default function StoreProfileCard({
  sellerId,
  businessName,
  city,
  country,
  activeAds,
  hasStorePage = true,
  askMapLocation = false,
  mapLocation = null,
}: {
  sellerId: string;
  businessName: string;
  city: string | null;
  country: string;
  activeAds: number;
  /** MangwaooMart sellers have a public store page listing their ads; food sellers don't. */
  hasStorePage?: boolean;
  /** Food sellers pin their kitchen on the map so customers nearby find them first in search. */
  askMapLocation?: boolean;
  mapLocation?: PickedLocation | null;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ businessName, city: city ?? '', country });
  const [pin, setPin] = useState<PickedLocation | null>(mapLocation);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const location = formatLocation(city, country);

  const startEditing = () => {
    setForm({ businessName, city: city ?? '', country });
    setPin(mapLocation);
    setError('');
    setIsEditing(true);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      const response = await fetch('/api/seller/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(askMapLocation ? { ...form, location: pin } : form),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Could not save your store details.');
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="store-profile-heading" className="mb-8 rounded-2xl bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="store-profile-heading" className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
            <Store className="h-5 w-5 text-accent" />
            Your store profile
          </h2>
          <p className="break-words text-base font-semibold text-ink">{businessName}</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-brand-gray">
            <li className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-accent" />
              {location}
            </li>
            {hasStorePage ? (
              <li className="flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-accent" />
                Active ads: <span className="font-semibold text-ink">{activeAds}</span>
              </li>
            ) : null}
          </ul>
          {!city ? (
            <p className="mt-2 text-xs text-warning">Add your city so buyers know where you are.</p>
          ) : null}
          {askMapLocation ? (
            mapLocation ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-gray">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span className="min-w-0 break-words">
                  Pinned on the map: <span className="font-semibold text-ink">{mapLocation.label}</span>
                </span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-warning">
                Pin your restaurant on the map so customers near you find you first when they search.
              </p>
            )
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {hasStorePage ? (
            <Link
              href={`/store/${sellerId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <ExternalLink className="h-4 w-4" />
              View store page
            </Link>
          ) : null}
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-gray-100 pt-5">
          <div>
            <label htmlFor="store-name" className="mb-1.5 block text-sm font-semibold text-ink">
              Store name
            </label>
            <input
              id="store-name"
              name="businessName"
              type="text"
              value={form.businessName}
              onChange={handleChange}
              maxLength={80}
              className={INPUT_CLASS}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="store-city" className="mb-1.5 block text-sm font-semibold text-ink">
                City
              </label>
              <input
                id="store-city"
                name="city"
                type="text"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. Karachi"
                list="store-city-list"
                maxLength={MAX_PLACE_LENGTH}
                autoComplete="address-level2"
                className={INPUT_CLASS}
              />
              <datalist id="store-city-list">
                {PAKISTAN_CITIES.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="store-country" className="mb-1.5 block text-sm font-semibold text-ink">
                Country
              </label>
              <input
                id="store-country"
                name="country"
                type="text"
                value={form.country}
                onChange={handleChange}
                placeholder={DEFAULT_COUNTRY}
                maxLength={MAX_PLACE_LENGTH}
                autoComplete="country-name"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {askMapLocation ? (
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-ink">Restaurant location on the map</span>
              <LocationPicker
                value={pin}
                onChange={setPin}
                placeholder="Search your shop, area or street"
                changeLabel="Change restaurant location"
              />
              <p className="mt-1.5 text-xs text-brand-gray">
                Customers searching for food see the restaurants nearest to their delivery address first.
              </p>
            </div>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-gradient-to-r from-brand-red-primary to-brand-red-secondary px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-light"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
