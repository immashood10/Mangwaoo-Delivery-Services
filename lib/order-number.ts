// The number a customer and a seller both see on an order: MW-M10001 (MangwaooMart) or MW-F10001 (food). The database
// numbers each kind separately from 10001 (`orderNumber`); the letter keeps the two kinds apart. Client-safe.

export type OrderKind = 'mart' | 'gulplaza';

export function orderRef(kind: OrderKind | 'MART' | 'GULPLAZA', orderNumber: number) {
  const letter = kind === 'mart' || kind === 'MART' ? 'M' : 'F';

  return `MW-${letter}${orderNumber}`;
}
