import type { Prisma } from '@/lib/generated/prisma/client';
import { parseOrderRef } from '@/lib/order-number';

// What an admin can type to find an order: its number ("MW-F10001", "F10001" or just "10001"), the customer's name or the
// seller's shop name. Used by the admin search box and by the Orders page (?q=). Both order tables share these fields.

export const MAX_ORDER_SEARCH_LENGTH = 80;

export type OrderSearchWhere = { mart: Prisma.OrderWhereInput; food: Prisma.GulplazaOrderWhereInput } | null;

export function orderSearchWhere(rawSearch: string): OrderSearchWhere {
  const search = rawSearch.trim().slice(0, MAX_ORDER_SEARCH_LENGTH);

  if (!search) return null;

  const byName = {
    OR: [
      { customer: { user: { name: { contains: search, mode: 'insensitive' as const } } } },
      { seller: { businessName: { contains: search, mode: 'insensitive' as const } } },
    ],
  };
  const full = parseOrderRef(search);

  if (full) {
    return full.kind === 'mart'
      ? { mart: { orderNumber: full.orderNumber }, food: { id: '__none__' } }
      : { mart: { id: '__none__' }, food: { orderNumber: full.orderNumber } };
  }

  // "F10001", "M10001", "mw-10001" or "10001": a letter is optional, digits alone match both kinds
  const loose = /^(?:MW-?)?([MF])?(\d{1,9})$/i.exec(search);

  if (loose) {
    const orderNumber = Number(loose[2]);
    const letter = loose[1]?.toUpperCase();

    if (Number.isSafeInteger(orderNumber) && orderNumber > 0) {
      return {
        mart: letter === 'F' ? { id: '__none__' } : { OR: [{ orderNumber }, byName] },
        food: letter === 'M' ? { id: '__none__' } : { OR: [{ orderNumber }, byName] },
      };
    }
  }

  return { mart: byName, food: byName };
}
