// Client-safe rules for rider signup identity details, shared by the form and the API.

// The photos a rider gives at signup: both sides of the CNIC and a clear photo of their face. All three are needed before
// an admin may approve the rider, and only admins can see them.
export const RIDER_DOCUMENT_KINDS = ['CNIC_FRONT', 'CNIC_BACK', 'FACE'] as const;
export type RiderDocumentKind = (typeof RIDER_DOCUMENT_KINDS)[number];

/** The heading over each photo on the admin's Rider Approvals page. */
export const RIDER_DOCUMENT_LABELS: Record<RiderDocumentKind, string> = {
  CNIC_FRONT: 'CNIC front',
  CNIC_BACK: 'CNIC back',
  FACE: 'Face photo',
};

/** How each photo is named inside a sentence ("Missing: face photo", "The face photo must be a JPG…"). */
export const RIDER_DOCUMENT_PHOTO_NAMES: Record<RiderDocumentKind, string> = {
  CNIC_FRONT: 'CNIC front photo',
  CNIC_BACK: 'CNIC back photo',
  FACE: 'face photo',
};

/** What a rider is told when a photo is missing from the signup form. */
export const RIDER_DOCUMENT_MISSING_MESSAGES: Record<RiderDocumentKind, string> = {
  CNIC_FRONT: 'Please add a photo of the front of your CNIC.',
  CNIC_BACK: 'Please add a photo of the back of your CNIC.',
  FACE: 'Please add a clear photo of your face.',
};

/** The multipart form field each photo is sent in. */
export const RIDER_DOCUMENT_FIELDS: Record<RiderDocumentKind, string> = {
  CNIC_FRONT: 'cnicFront',
  CNIC_BACK: 'cnicBack',
  FACE: 'facePhoto',
};

export const MAX_RIDER_DOCUMENT_BYTES = 3 * 1024 * 1024;

export const RIDER_VEHICLE_TYPES = ['Motorbike', 'Bicycle', 'Car', 'Rickshaw'] as const;
const VEHICLES_WITHOUT_PLATE = new Set<string>(['Bicycle']);

export function vehicleNeedsNumberPlate(vehicleType: string) {
  return !VEHICLES_WITHOUT_PLATE.has(vehicleType);
}

/**
 * What a rider's application still lacks before an admin may approve it: the CNIC number,
 * both CNIC photos, a photo of the rider's face and, for anything with an engine, the vehicle's number plate.
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
      missing.push(RIDER_DOCUMENT_PHOTO_NAMES[kind]);
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
