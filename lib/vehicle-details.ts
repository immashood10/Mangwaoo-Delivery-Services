// Details a seller fills in when posting a vehicle ad (category "Vehicles").
// Client-safe: shared by the post/edit forms, the API validation and the product page.

export const VEHICLE_CATEGORY_NAME = 'Vehicles';

export function isVehicleCategory(categoryName: string | null | undefined) {
  return categoryName === VEHICLE_CATEGORY_NAME;
}

export const VEHICLE_FIELD_KEYS = [
  'make',
  'model',
  'year',
  'engineType',
  'engineCapacity',
  'ignitionType',
  'origin',
  'condition',
  'registrationCity',
] as const;

export type VehicleFieldKey = (typeof VEHICLE_FIELD_KEYS)[number];
export type VehicleDetails = Record<VehicleFieldKey, string>;

export type VehicleField = {
  key: VehicleFieldKey;
  label: string;
} & (
  | { type: 'text'; placeholder: string; suggestions?: readonly string[] }
  | { type: 'select'; options: readonly string[] }
);

const MIN_YEAR = 1970;
const MAX_TEXT_LENGTH = 40;

/** This year and next (new models are sold ahead of the calendar year), newest first. */
export function getVehicleYearOptions() {
  const newest = new Date().getFullYear() + 1;
  return Array.from({ length: newest - MIN_YEAR + 1 }, (_, i) => String(newest - i));
}

export const VEHICLE_FIELDS: readonly VehicleField[] = [
  {
    key: 'make',
    label: 'Make',
    type: 'text',
    placeholder: 'e.g. Honda, Yamaha, Suzuki',
    suggestions: [
      'Honda',
      'Yamaha',
      'Suzuki',
      'United',
      'Road Prince',
      'Super Power',
      'Unique',
      'Hi Speed',
      'Ravi',
      'Metro',
      'Kawasaki',
      'Benelli',
      'Harley-Davidson',
      'Ducati',
      'BMW',
      'Toyota',
    ],
  },
  { key: 'model', label: 'Model', type: 'text', placeholder: 'e.g. CD 70, YBR 125, YZF-R1' },
  { key: 'year', label: 'Year', type: 'select', options: getVehicleYearOptions() },
  { key: 'engineType', label: 'Engine Type', type: 'select', options: ['2 Stroke', '4 Stroke'] },
  {
    key: 'engineCapacity',
    label: 'Engine Capacity',
    type: 'select',
    options: [
      'Up to 70cc',
      '71cc - 100cc',
      '101cc - 125cc',
      '126cc - 149cc',
      '150cc - 249cc',
      '250cc - 299cc',
      '300cc - 499cc',
      '500cc & above',
    ],
  },
  { key: 'ignitionType', label: 'Ignition type', type: 'select', options: ['Self Start', 'Kick Start', 'Self & Kick Start'] },
  { key: 'origin', label: 'Origin', type: 'select', options: ['Pakistani', 'Chinese', 'Japanese', 'Indian', 'Imported', 'Other'] },
  { key: 'condition', label: 'Condition', type: 'select', options: ['New', 'Used'] },
  {
    key: 'registrationCity',
    label: 'Registration City',
    type: 'select',
    options: [
      'Karachi',
      'Lahore',
      'Islamabad',
      'Rawalpindi',
      'Faisalabad',
      'Multan',
      'Hyderabad',
      'Peshawar',
      'Quetta',
      'Sialkot',
      'Gujranwala',
      'Other',
      'Un-registered',
    ],
  },
];

export function emptyVehicleDetails(): VehicleDetails {
  return Object.fromEntries(VEHICLE_FIELD_KEYS.map((key) => [key, ''])) as VehicleDetails;
}

/** Reads stored JSON back into form/display shape (lenient: unknown keys and bad values are dropped). */
export function parseVehicleDetails(value: unknown): VehicleDetails | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const details = emptyVehicleDetails();
  let hasAny = false;

  for (const key of VEHICLE_FIELD_KEYS) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.trim()) {
      details[key] = raw.trim();
      hasAny = true;
    }
  }

  return hasAny ? details : null;
}

/** Strict check for a new/edited vehicle ad: every field is required and select values must be valid options. */
export function validateVehicleDetails(input: unknown): { details: VehicleDetails } | { error: string } {
  const record = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const details = emptyVehicleDetails();

  for (const field of VEHICLE_FIELDS) {
    const raw = record[field.key];
    const value = (typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : '').trim();

    if (!value) {
      return { error: `Please fill in the vehicle's ${field.label.toLowerCase()}.` };
    }

    if (field.type === 'select' && !field.options.includes(value)) {
      return { error: `Please choose a valid ${field.label.toLowerCase()}.` };
    }

    if (field.type === 'text' && value.length > MAX_TEXT_LENGTH) {
      return { error: `${field.label} must be ${MAX_TEXT_LENGTH} characters or fewer.` };
    }

    details[field.key] = value;
  }

  return { details };
}
