import { Bike } from 'lucide-react';
import { VEHICLE_FIELDS, type VehicleDetails, type VehicleFieldKey } from '@/lib/vehicle-details';

const INPUT_CLASS =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-transparent outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100';

/**
 * The "Details" inputs shown while a seller posts or edits a vehicle ad
 * (category "Vehicles"). Controlled: the parent owns the values.
 */
export default function VehicleDetailsFields({
  values,
  onChange,
  idPrefix = 'vehicle',
  columns = 1,
}: {
  values: VehicleDetails;
  onChange: (key: VehicleFieldKey, value: string) => void;
  /** Keeps ids unique when the fields appear in two places on one page (post form + edit modal). */
  idPrefix?: string;
  /** Use 2 where there is room (wide modal); the narrow post form needs 1 so values aren't cut off. */
  columns?: 1 | 2;
}) {
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="flex items-center gap-1.5 px-2 text-sm font-semibold text-ink">
        <Bike className="h-4 w-4 text-accent" />
        Vehicle details
      </legend>

      <div className={`grid grid-cols-1 gap-4 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
        {VEHICLE_FIELDS.map((field) => {
          const id = `${idPrefix}-${field.key}`;

          return (
            <div key={field.key}>
              <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
                {field.label}
              </label>

              {field.type === 'select' ? (
                <select
                  id={id}
                  value={values[field.key]}
                  onChange={(event) => onChange(field.key, event.target.value)}
                  className={INPUT_CLASS}
                  required
                >
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    id={id}
                    type="text"
                    value={values[field.key]}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    list={field.suggestions ? `${id}-list` : undefined}
                    maxLength={40}
                    autoComplete="off"
                    className={INPUT_CLASS}
                    required
                  />
                  {field.suggestions ? (
                    <datalist id={`${id}-list`}>
                      {field.suggestions.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
