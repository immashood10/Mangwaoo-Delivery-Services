import { VEHICLE_FIELDS, type VehicleDetails } from '@/lib/vehicle-details';

/** Read-only "Details" grid for a vehicle ad (Make, Model, Year, …). */
export default function VehicleDetailsList({ details }: { details: VehicleDetails }) {
  const rows = VEHICLE_FIELDS.filter((field) => details[field.key]);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="vehicle-details-heading">
      <h2 id="vehicle-details-heading" className="mb-3 text-sm font-bold text-ink">
        Details
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-gray-100 bg-surface p-5 shadow-soft sm:grid-cols-3">
        {rows.map((field) => (
          <div key={field.key}>
            <dt className="text-xs text-brand-gray">{field.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{details[field.key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
