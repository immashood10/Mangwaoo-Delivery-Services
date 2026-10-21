export type AddressTag = 'Home' | 'Office' | 'Partner' | 'Other';

export const ADDRESS_TAGS: { value: AddressTag; label: string }[] = [
  { value: 'Home', label: 'Home' },
  { value: 'Office', label: 'Office' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Other', label: 'Other' },
];

export const MAX_ADDRESS_LABEL_LENGTH = 30;

export type SavedAddress = {
  id: string;
  label: string;
  street: string;
  lat: number;
  lng: number;
};

export type NewSavedAddress = Omit<SavedAddress, 'id'>;

const SAME_SPOT_THRESHOLD_DEGREES = 0.0005; // ~50 m

export function isSameSpot(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return (
    Math.abs(a.lat - b.lat) < SAME_SPOT_THRESHOLD_DEGREES &&
    Math.abs(a.lng - b.lng) < SAME_SPOT_THRESHOLD_DEGREES
  );
}

export function getAddressTag(label: string): AddressTag {
  return ADDRESS_TAGS.find((tag) => tag.value === label)?.value ?? 'Other';
}

// Saved addresses belong to an account and live in the database; only logged-in customers have them.
export async function fetchSavedAddresses(): Promise<SavedAddress[]> {
  const response = await fetch('/api/addresses');
  if (!response.ok) {
    throw new Error('Could not load saved addresses');
  }

  const data = (await response.json()) as { addresses: SavedAddress[] };
  return data.addresses;
}

export async function saveAddress(address: NewSavedAddress): Promise<SavedAddress> {
  const response = await fetch('/api/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(address),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.address) {
    throw new Error(data?.error ?? 'Could not save address');
  }

  return data.address as SavedAddress;
}

const REMOVED_EVENT = 'mangwaoo:saved-address-removed';

/** Tells the navbar's address picker that a saved address was removed from somewhere else (e.g. Settings). */
export function announceSavedAddressRemoved(id: string) {
  window.dispatchEvent(new CustomEvent<string>(REMOVED_EVENT, { detail: id }));
}

/** Subscribes to {@link announceSavedAddressRemoved}; returns the unsubscribe function. */
export function onSavedAddressRemoved(listener: (id: string) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(REMOVED_EVENT, handler);
  return () => window.removeEventListener(REMOVED_EVENT, handler);
}

export async function deleteSavedAddress(id: string) {
  const response = await fetch(`/api/addresses/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error('Could not delete address');
  }
}
