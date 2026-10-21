// Client-safe rules for rider signup identity details, shared by the form and the API.

export const RIDER_DOCUMENT_KINDS = ['CNIC_FRONT', 'CNIC_BACK'] as const;
export type RiderDocumentKind = (typeof RIDER_DOCUMENT_KINDS)[number];

export const RIDER_DOCUMENT_LABELS: Record<RiderDocumentKind, string> = {
  CNIC_FRONT: 'CNIC front',
  CNIC_BACK: 'CNIC back',
};

export const MAX_RIDER_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const ALLOWED_RIDER_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const RIDER_VEHICLE_TYPES = ['Motorbike', 'Bicycle', 'Car', 'Rickshaw'] as const;
const VEHICLES_WITHOUT_PLATE = new Set<string>(['Bicycle']);

export function vehicleNeedsNumberPlate(vehicleType: string) {
  return !VEHICLES_WITHOUT_PLATE.has(vehicleType);
}

/**
 * What a rider's application still lacks before an admin may approve it: the CNIC number,
 * both CNIC photos and, for anything with an engine, the vehicle's number plate.
 * An empty list means the application is complete.
 */
export function getMissingRiderRequirements(rider: {
  vehicleType: string | null;
  numberPlate: string | null;
  cnicNumber: string | null;
  documentKinds: readonly string[];
}): string[] {
  const missing: string[] = [];

  if (!rider.cnicNumber || !isValidCnic(rider.cnicNumber)) {
    missing.push('CNIC number');
  }

  for (const kind of RIDER_DOCUMENT_KINDS) {
    if (!rider.documentKinds.includes(kind)) {
      missing.push(`${RIDER_DOCUMENT_LABELS[kind]} photo`);
    }
  }

  // Older accounts may have no vehicle type saved; those are treated as motorbikes.
  const vehicleType = rider.vehicleType ?? RIDER_VEHICLE_TYPES[0];
  if (vehicleNeedsNumberPlate(vehicleType) && !(rider.numberPlate && isValidNumberPlate(rider.numberPlate))) {
    missing.push('number plate');
  }

  return missing;
}

/** "4210112345671" or "42101-1234567-1" → "42101-1234567-1" (partial input is formatted as typed). */
export function formatCnic(input: string) {
  const digits = input.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function isValidCnic(input: string) {
  return /^\d{5}-\d{7}-\d$/.test(formatCnic(input));
}

/** Uppercases and tidies a registration number, e.g. " khi 1234 " → "KHI-1234". */
export function normalizeNumberPlate(input: string) {
  return input
    .toUpperCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function isValidNumberPlate(input: string) {
  const plate = normalizeNumberPlate(input);
  return /^[A-Z0-9][A-Z0-9-]{1,11}$/.test(plate) && /\d/.test(plate);
}
