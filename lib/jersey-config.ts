export const JERSEY_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
export const JERSEY_PATTERNS = ['SOLID', 'STRIPES', 'DIAGONAL', 'CHEVRON', 'GEOMETRIC', 'CAMO'] as const;
export const JERSEY_COLLARS = ['CREW', 'V_NECK', 'POLO'] as const;
export const JERSEY_SLEEVES = ['SHORT', 'LONG'] as const;
export const JERSEY_LOGO_PLACEMENTS = ['FRONT_CHEST', 'LEFT_SLEEVE', 'RIGHT_SLEEVE', 'UPPER_BACK', 'LOWER_BACK'] as const;

export type JerseySizeValue = (typeof JERSEY_SIZES)[number];
export type JerseyPatternValue = (typeof JERSEY_PATTERNS)[number];
export type JerseyCollarValue = (typeof JERSEY_COLLARS)[number];
export type JerseySleeveValue = (typeof JERSEY_SLEEVES)[number];
export type JerseyLogoPlacementValue = (typeof JERSEY_LOGO_PLACEMENTS)[number];

export const JERSEY_PATTERN_LABELS: Record<JerseyPatternValue, string> = {
  SOLID: 'Clean solid',
  STRIPES: 'Classic stripes',
  DIAGONAL: 'Dynamic diagonal',
  CHEVRON: 'Chevron',
  GEOMETRIC: 'Modern geometric',
  CAMO: 'Tonal camo',
};

export const JERSEY_COLLAR_LABELS: Record<JerseyCollarValue, string> = {
  CREW: 'Crew neck',
  V_NECK: 'V neck',
  POLO: 'Polo collar',
};

export const JERSEY_SLEEVE_LABELS: Record<JerseySleeveValue, string> = {
  SHORT: 'Short sleeve',
  LONG: 'Long sleeve',
};

export const JERSEY_PLACEMENT_LABELS: Record<JerseyLogoPlacementValue, string> = {
  FRONT_CHEST: 'Front chest',
  LEFT_SLEEVE: 'Left sleeve',
  RIGHT_SLEEVE: 'Right sleeve',
  UPPER_BACK: 'Upper back',
  LOWER_BACK: 'Lower back',
};

export const MAX_JERSEY_LOGOS = 5;
export const MAX_JERSEY_LOGO_BYTES = 500_000;
export const MAX_JERSEY_LOGO_TOTAL_BYTES = 1_500_000;
export const MAX_JERSEY_BASE_IMAGE_BYTES = 3_000_000;
export const MAX_JERSEY_SUBMISSION_BYTES = 2_000_000;

export type JerseyFields = {
  customerName: string;
  phone: string;
  playerName: string;
  jerseyNumber: number;
  teamName: string;
  size: JerseySizeValue;
  primaryColor: string;
  secondaryColor: string;
  pattern: JerseyPatternValue;
  collar: JerseyCollarValue;
  sleeve: JerseySleeveValue;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

/** Validate the same public form fields before the AI call and before the final database write. */
export function parseJerseyFields(value: unknown): { ok: true; fields: JerseyFields } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: 'Please complete the jersey details.' };

  const customerName = cleanText(value.customerName, 80);
  const phone = cleanText(value.phone, 30);
  const playerName = cleanText(value.playerName, 32);
  const teamName = cleanText(value.teamName, 48);
  const jerseyNumber = typeof value.jerseyNumber === 'number' ? value.jerseyNumber : Number(value.jerseyNumber);
  const size = value.size;
  const pattern = value.pattern;
  const collar = value.collar;
  const sleeve = value.sleeve;
  const primaryColor = typeof value.primaryColor === 'string' ? value.primaryColor.toUpperCase() : '';
  const secondaryColor = typeof value.secondaryColor === 'string' ? value.secondaryColor.toUpperCase() : '';

  if (!customerName || !phone || !playerName || !teamName) {
    return { ok: false, error: 'Enter your name, phone, player name and team name.' };
  }
  if (!/^[+\d][\d\s().-]{6,28}$/.test(phone) || phone.replace(/\D/g, '').length < 8) {
    return { ok: false, error: 'Enter a valid phone number.' };
  }
  if (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99) {
    return { ok: false, error: 'Jersey number must be from 0 to 99.' };
  }
  if (!JERSEY_SIZES.includes(size as JerseySizeValue)) return { ok: false, error: 'Choose a jersey size.' };
  if (!JERSEY_PATTERNS.includes(pattern as JerseyPatternValue)) return { ok: false, error: 'Choose a jersey pattern.' };
  if (!JERSEY_COLLARS.includes(collar as JerseyCollarValue)) return { ok: false, error: 'Choose a collar style.' };
  if (!JERSEY_SLEEVES.includes(sleeve as JerseySleeveValue)) return { ok: false, error: 'Choose a sleeve style.' };
  if (!/^#[0-9A-F]{6}$/.test(primaryColor) || !/^#[0-9A-F]{6}$/.test(secondaryColor)) {
    return { ok: false, error: 'Choose valid jersey colours.' };
  }

  return {
    ok: true,
    fields: {
      customerName,
      phone,
      playerName,
      jerseyNumber,
      teamName,
      size: size as JerseySizeValue,
      primaryColor,
      secondaryColor,
      pattern: pattern as JerseyPatternValue,
      collar: collar as JerseyCollarValue,
      sleeve: sleeve as JerseySleeveValue,
    },
  };
}

