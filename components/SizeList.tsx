import { getSizeHeading, type SizeDetails } from '@/lib/size-options';

/** Read-only "Available sizes" chips for a clothes or shoes ad. */
export default function SizeList({ details }: { details: SizeDetails }) {
  if (details.sizeType === 'none' || details.sizes.length === 0) return null;

  return (
    <section aria-labelledby="available-sizes-heading">
      <h2 id="available-sizes-heading" className="mb-2 text-sm font-bold text-ink">
        {getSizeHeading(details.sizeType)} available
      </h2>
      <ul className="flex flex-wrap gap-2">
        {details.sizes.map((size) => (
          <li
            key={size}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-1.5 text-sm font-semibold text-ink"
          >
            {size}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-brand-gray">
        Add the size you want to the &ldquo;Note for the vendor&rdquo; when you check out, or ask the seller in chat.
      </p>
    </section>
  );
}
