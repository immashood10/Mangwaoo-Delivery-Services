'use client';

import { FOOD_ICON_CHOICES, GENERIC_FOOD_ICON, guessFoodIcon } from '@/lib/food-icons';

/**
 * "Picture for this dish": the small icon (🍛 for biryani, 🍦 for ice cream…) customers see on the dish before they order it,
 * wherever there is no photo. Left on Automatic it follows the dish's name; the seller can also pick one by hand.
 * `value` is the chosen emoji, null = automatic.
 */
export default function FoodIconPicker({
  value,
  onChange,
  dishName,
  idPrefix,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  dishName: string;
  idPrefix: string;
}) {
  const guessed = guessFoodIcon(dishName);
  const shown = value ?? guessed ?? GENERIC_FOOD_ICON;
  const buttonClass = (active: boolean) =>
    `flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition ${
      active ? 'border-accent bg-brand-red-primary/10 ring-2 ring-red-100' : 'border-gray-200 hover:border-gray-400'
    }`;

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4" data-testid={`${idPrefix}-icon-picker`}>
      <legend className="px-1 text-sm font-semibold text-ink">Picture for this dish</legend>

      <div className="flex items-center gap-3">
        <span aria-hidden="true" data-testid={`${idPrefix}-icon-preview`} className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-light text-3xl">
          {shown}
        </span>
        <p className="text-xs text-brand-gray">
          Customers see this picture on your dish before they order it{value === null ? (guessed ? `, picked from the name (${guessed})` : ', so choose one that fits') : ''}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dish picture">
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={`rounded-lg border px-3 text-xs font-semibold ${
            value === null ? 'border-accent bg-brand-red-primary/10 text-accent ring-2 ring-red-100' : 'border-gray-200 text-ink hover:border-gray-400'
          } h-10`}
        >
          Automatic
        </button>
        {FOOD_ICON_CHOICES.map((choice) => (
          <button
            key={choice.icon}
            type="button"
            role="radio"
            aria-checked={value === choice.icon}
            aria-label={choice.label}
            title={choice.label}
            data-icon={choice.icon}
            onClick={() => onChange(choice.icon)}
            className={buttonClass(value === choice.icon)}
          >
            <span aria-hidden="true">{choice.icon}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
