// Sizes a seller picks when posting clothes or shoes (categories Men, Women, Kids).
// Client-safe: shared by the post/edit forms, the API validation and the product page.
// Stored in Product.attributes as { sizeType, sizes } (vehicle ads use the same column for their own details).

export const SIZED_CATEGORY_NAMES = ['Men', 'Women', 'Kids'] as const;

export function isSizedCategory(categoryName: string | null | undefined) {
  return SIZED_CATEGORY_NAMES.some((name) => name === categoryName);
}

export const SIZE_TYPES = ['clothing', 'shoes', 'none'] as const;
export type SizeType = (typeof SIZE_TYPES)[number];

export type SizeDetails = { sizeType: SizeType; sizes: string[] };

/** Labels for the "what are you selling" choice. "none" is for bags, watches, toys and other things without sizes. */
export const SIZE_TYPE_LABELS: Record<SizeType, string> = {
  clothing: 'Clothes',
  shoes: 'Shoes',
  none: 'Something else (no sizes)',
};

const MAX_SIZES = 40;
const MAX_SIZE_LENGTH = 20;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const ADULT_CLOTHING = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free size'] as const;
const KIDS_CLOTHING = [
  '0-3 months',
  '3-6 months',
  '6-12 months',
  '1-2 years',
  '2-3 years',
  '3-4 years',
  '4-5 years',
  '5-6 years',
  '6-7 years',
  '7-8 years',
  '8-9 years',
  '9-10 years',
  '10-12 years',
  '12-14 years',
] as const;
const ADULT_SHOES = range(36, 47).map((size) => `EU ${size}`);
const KIDS_SHOES = range(18, 35).map((size) => `EU ${size}`);

/** The sizes offered for a category and kind of item, in the order they are shown. */
export function getSizeOptions(categoryName: string | null | undefined, sizeType: SizeType): readonly string[] {
  const isKids = categoryName === 'Kids';

  if (sizeType === 'clothing') return isKids ? KIDS_CLOTHING : ADULT_CLOTHING;
  if (sizeType === 'shoes') return isKids ? KIDS_SHOES : ADULT_SHOES;
  return [];
}

export function getSizeHeading(sizeType: SizeType) {
  return sizeType === 'shoes' ? 'Shoe sizes' : 'Sizes';
}

export function emptySizeDetails(): SizeDetails {
  return { sizeType: 'clothing', sizes: [] };
}

/** Reads stored JSON back into form/display shape (lenient: bad values are dropped; vehicle details give null). */
export function parseSizeDetails(value: unknown): SizeDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const sizeType = SIZE_TYPES.find((type) => type === record.sizeType);

  if (!sizeType) return null;

  const sizes = Array.isArray(record.sizes)
    ? record.sizes
        .filter((size): size is string => typeof size === 'string')
        .map((size) => size.trim())
        .filter((size) => size.length > 0 && size.length <= MAX_SIZE_LENGTH)
        .slice(0, MAX_SIZES)
    : [];

  return { sizeType, sizes: sizeType === 'none' ? [] : sizes };
}

/** Strict check for a new/edited clothes or shoes listing: a kind of item, and at least one valid size unless it has none. */
export function validateSizeDetails(
  categoryName: string,
  input: unknown
): { details: SizeDetails } | { error: string } {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const sizeType = SIZE_TYPES.find((type) => type === record.sizeType);

  if (!sizeType) {
    return { error: 'Please choose whether you are selling clothes, shoes or something without sizes.' };
  }

  if (sizeType === 'none') {
    return { details: { sizeType, sizes: [] } };
  }

  const options = getSizeOptions(categoryName, sizeType);
  const picked = Array.isArray(record.sizes) ? record.sizes : [];

  if (picked.some((size) => typeof size !== 'string' || !options.includes(size))) {
    return { error: `Please choose valid ${sizeType === 'shoes' ? 'shoe' : 'clothing'} sizes.` };
  }

  // Store them in display order, without repeats.
  const sizes = options.filter((option) => picked.includes(option));

  if (sizes.length === 0) {
    return { error: 'Please choose at least one size.' };
  }

  return { details: { sizeType, sizes } };
}
