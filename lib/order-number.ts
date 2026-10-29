// The number a customer and a seller both see on an order: MW-M10001 (MangwaooMart) or MW-F10001 (food). The database
// numbers each kind separately from 10001 (`orderNumber`); the letter keeps the two kinds apart. Client-safe.

export type OrderKind = 'mart' | 'gulplaza';

export function orderRef(kind: OrderKind | 'MART' | 'GULPLAZA', orderNumber: number) {
  const letter = kind === 'mart' || kind === 'MART' ? 'M' : 'F';

  return `MW-${letter}${orderNumber}`;
}

/** Where the customer follows that order live (app/track/[ref]). Opening it marks the order's notifications as seen. */
export function trackingPath(ref: string) {
  return `/track/${ref}`;
}

/** The other way round: "MW-F10001" (any case) gives its kind and number; anything else gives null. */
export function parseOrderRef(ref: string): { kind: OrderKind; orderNumber: number } | null {
  const match = /^MW-([MF])(\d{1,9})$/i.exec(ref.trim());

  if (!match) return null;

  const orderNumber = Number(match[2]);

  if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) return null;

  return { kind: match[1].toUpperCase() === 'M' ? 'mart' : 'gulplaza', orderNumber };
}
