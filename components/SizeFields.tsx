import { Ruler } from 'lucide-react';
import {
  SIZE_TYPES,
  SIZE_TYPE_LABELS,
  getSizeOptions,
  type SizeDetails,
  type SizeType,
} from '@/lib/size-options';

const CHIP_CLASS =
  'inline-flex cursor-pointer select-none items-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-accent peer-checked:border-accent peer-checked:bg-brand-red-primary/10 peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent';

/**
 * The "Sizes" inputs shown while a seller posts or edits clothes or shoes
 * (categories Men, Women, Kids). Controlled: the parent owns the value.
 */
export default function SizeFields({
  categoryName,
  value,
  onChange,
  idPrefix = 'size',
}: {
  categoryName: string | undefined;
  value: SizeDetails;
  onChange: (value: SizeDetails) => void;
  /** Keeps ids unique when the fields appear in two places on one page (post form + edit modal). */
  idPrefix?: string;
}) {
  const options = getSizeOptions(categoryName, value.sizeType);

  const chooseType = (sizeType: SizeType) => {
    // Each kind of item has its own sizes, so the earlier picks no longer apply.
    if (sizeType !== value.sizeType) onChange({ sizeType, sizes: [] });
  };

  const toggleSize = (size: string) => {
    const sizes = value.sizes.includes(size) ? value.sizes.filter((item) => item !== size) : [...value.sizes, size];
    onChange({ ...value, sizes });
  };

  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="flex items-center gap-1.5 px-2 text-sm font-semibold text-ink">
        <Ruler className="h-4 w-4 text-accent" />
        Sizes
      </legend>

      <div role="radiogroup" aria-label="What are you selling?" className="flex flex-wrap gap-2">
        {SIZE_TYPES.map((type) => {
          const id = `${idPrefix}-type-${type}`;

          return (
            <div key={type}>
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-type`}
                checked={value.sizeType === type}
                onChange={() => chooseType(type)}
                className="peer sr-only"
              />
              <label htmlFor={id} className={CHIP_CLASS}>
                {SIZE_TYPE_LABELS[type]}
              </label>
            </div>
          );
        })}
      </div>

      {value.sizeType === 'none' ? (
        <p className="mt-3 text-sm text-brand-gray">Customers won&apos;t be shown any sizes for this one.</p>
      ) : (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">
              {value.sizeType === 'shoes' ? 'Shoe sizes' : 'Clothing sizes'} available
            </span>
            <span className="flex items-center gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onChange({ ...value, sizes: [...options] })}
                className="text-accent hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, sizes: [] })}
                disabled={value.sizes.length === 0}
                className="text-brand-gray hover:text-ink hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Clear
              </button>
            </span>
          </div>

          <div role="group" aria-label="Available sizes" className="flex flex-wrap gap-2">
            {options.map((size) => {
              const id = `${idPrefix}-${size.replace(/\s+/g, '-')}`;

              return (
                <div key={size}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={value.sizes.includes(size)}
                    onChange={() => toggleSize(size)}
                    className="peer sr-only"
                  />
                  <label htmlFor={id} className={CHIP_CLASS}>
                    {size}
                  </label>
                </div>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-brand-gray">
            {value.sizes.length === 0 ? 'Pick every size you have in stock.' : `${value.sizes.length} selected`}
          </p>
        </div>
      )}
    </fieldset>
  );
}
