// Food dishes sold by weight: one dish, several sizes (250 g, 375 g, 500 g, 750 g, 1 kg ...), each with its own price.
// Client-safe (no server imports): the seller's form, the menu, the cart and the server all read sizes through here.
//
// Where they live: `GulplazaProduct.portions` (JSON, sorted smallest first) with `GulplazaProduct.price` holding the lowest
// price, so every list can say "From PKR ..."; `GulplazaOrderItem.portionGrams` + `price` remember what was ordered; and a
// cart row for a dish sold by weight has the size in its `productId` (see `cartRowProductId`).

export type Portion = { grams: number; price: number };

export const MAX_PORTIONS = 10;
export const MIN_PORTION_GRAMS = 1;
/** 1000 kg: a wholesaler sells rice by the sack. */
export const MAX_PORTION_GRAMS = 1_000_000;
export const MAX_PORTION_PRICE = 10_000_000;

/** The sizes the seller's form offers as one-tap buttons. */
export const COMMON_PORTION_GRAMS = [250, 375, 500, 750, 1000] as const;

/** 250 -> "250 g", 1000 -> "1 kg", 1500 -> "1.5 kg". */
export function formatPortion(grams: number) {
  if (grams < 1000) return `${grams} g`;

  const kilos = grams / 1000;

  return `${Number.isInteger(kilos) ? kilos : Number(kilos.toFixed(3))} kg`;
}

/** "Beef Yakhni Pulao (500 g)" for a size, the plain name for a dish with one price. */
export function withPortionLabel(name: string, grams: number | null | undefined) {
  return grams ? `${name} (${formatPortion(grams)})` : name;
}

const toNumber = (value: unknown) => (typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN);

const bySize = (a: Portion, b: Portion) => a.grams - b.grams;

const isValidGrams = (grams: number) => Number.isInteger(grams) && grams >= MIN_PORTION_GRAMS && grams <= MAX_PORTION_GRAMS;

const isValidPrice = (price: number) => Number.isFinite(price) && price > 0 && price <= MAX_PORTION_PRICE;

/** The sizes saved on a dish (what the database holds). Anything that doesn't fit is left out, never thrown on. */
export function readPortions(value: unknown): Portion[] {
  if (!Array.isArray(value)) return [];

  const bySizeGrams = new Map<number, Portion>();

  for (const entry of value.slice(0, MAX_PORTIONS)) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const grams = toNumber(record.grams);
    const price = toNumber(record.price);

    if (isValidGrams(grams) && isValidPrice(price)) bySizeGrams.set(grams, { grams, price });
  }

  return [...bySizeGrams.values()].sort(bySize);
}

/** The sizes a seller sent: checked strictly, with a message for the first problem. Nothing sent = a dish with one price. */
export function parsePortionsInput(value: unknown): { portions: Portion[] } | { error: string } {
  if (value === undefined || value === null) return { portions: [] };
  if (!Array.isArray(value)) return { error: 'The sizes are not valid.' };
  if (value.length > MAX_PORTIONS) return { error: `You can add up to ${MAX_PORTIONS} sizes to a dish.` };

  const seen = new Set<number>();
  const portions: Portion[] = [];

  for (const entry of value) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const grams = toNumber(record.grams);
    const price = toNumber(record.price);

    if (!isValidGrams(grams)) {
      return { error: `Each size must be a weight between ${formatPortion(MIN_PORTION_GRAMS)} and ${formatPortion(MAX_PORTION_GRAMS)}.` };
    }

    if (!isValidPrice(price)) return { error: `Please enter a price for ${formatPortion(grams)}.` };
    if (seen.has(grams)) return { error: `${formatPortion(grams)} is listed twice.` };

    seen.add(grams);
    portions.push({ grams, price: Math.round(price * 100) / 100 });
  }

  return { portions: portions.sort(bySize) };
}

/** The lowest price of a dish sold by weight (what the dish's own `price` holds). */
export function lowestPortionPrice(portions: Portion[]) {
  return Math.min(...portions.map((portion) => portion.price));
}

/** "PKR 450" for a dish with one price (or one size), "From PKR 300" for a dish sold in several sizes. */
export function dishPriceLabel(price: number, portions: Portion[]) {
  return portions.length > 1 ? `From PKR ${lowestPortionPrice(portions).toLocaleString()}` : `PKR ${price.toLocaleString()}`;
}

/** "250 g · 375 g · 500 g" for a table cell. */
export function portionSizesLabel(portions: Portion[]) {
  return portions.map((portion) => formatPortion(portion.grams)).join(' · ');
}

// ── The cart ────────────────────────────────────────────────
// A customer's cart is replaced wholesale and each row is unique per (customer, productId, marketplace). Two sizes of the
// same dish are two different lines, so a dish sold by weight is stored with the size after a "#" in the row's productId
// ("<dish id>#500"). Only /api/cart reads and writes these; everything else sees the clean id and a separate `portion`.

const CART_ROW_SEPARATOR = '#';

/** The productId of a cart row: the dish id, plus the size for a dish sold by weight (0 = no size). */
export function cartRowProductId(productId: string, grams: number) {
  return grams > 0 ? `${productId}${CART_ROW_SEPARATOR}${grams}` : productId;
}

/** The dish id and size (0 = none) behind a cart row's productId. */
export function splitCartRowProductId(rowProductId: string): { productId: string; grams: number } {
  const at = rowProductId.lastIndexOf(CART_ROW_SEPARATOR);
  if (at === -1) return { productId: rowProductId, grams: 0 };

  const grams = Number(rowProductId.slice(at + 1));

  return isValidGrams(grams) ? { productId: rowProductId.slice(0, at), grams } : { productId: rowProductId, grams: 0 };
}
