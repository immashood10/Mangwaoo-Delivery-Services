'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

/** The delivery address the customer has picked in the navbar (shared with checkout). */
export type DeliveryAddress = {
  id: string;
  label: string;
  postalCode: string;
  lat: number;
  lng: number;
  /** Set when this address is one of the customer's saved places (Home, Office, …). */
  savedAs?: string;
};

type DeliveryAddressContextValue = {
  address: DeliveryAddress | null;
  setAddress: Dispatch<SetStateAction<DeliveryAddress | null>>;
  /** Counts how many times a page asked the navbar to open its "choose your delivery address" window. */
  pickerRequests: number;
  /** For a page's "Select your address" button: the navbar owns the window, so the page just asks. */
  requestAddressPicker: () => void;
};

const DeliveryAddressContext = createContext<DeliveryAddressContextValue | null>(null);

// Held in memory only. What survives a reload comes from the database: a logged-in customer's saved
// addresses, or the location a visitor last shared (see /api/visitor) — nothing is written to browser storage.
export function DeliveryAddressProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [pickerRequests, setPickerRequests] = useState(0);
  const requestAddressPicker = useCallback(() => setPickerRequests((count) => count + 1), []);
  const value = useMemo(
    () => ({ address, setAddress, pickerRequests, requestAddressPicker }),
    [address, pickerRequests, requestAddressPicker]
  );

  return <DeliveryAddressContext.Provider value={value}>{children}</DeliveryAddressContext.Provider>;
}

export function useDeliveryAddress() {
  const context = useContext(DeliveryAddressContext);
  if (!context) {
    throw new Error('useDeliveryAddress must be used within a DeliveryAddressProvider');
  }
  return context;
}
