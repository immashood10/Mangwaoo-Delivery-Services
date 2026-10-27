'use client';

import { Plus, Trash2 } from 'lucide-react';
import {
  COMMON_PORTION_GRAMS,
  MAX_PORTIONS,
  formatPortion,
  type Portion,
} from '@/lib/food-portions';

/** One line of the sizes list while the seller is typing: the amount, its unit and the price, all as text. */
export type PortionRow = { key: string; amount: string; unit: 'g' | 'kg'; price: string };

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-xl bg-transparent outline-none transition focus:border-accent focus:ring-2 focus:ring-red-100';

let nextKey = 0;
const newKey = () => `portion-${nextKey++}`;

/** The rows to show for the sizes a dish already has (the Edit window). */
export function portionRowsFrom(portions: Portion[]): PortionRow[] {
  return portions.map((portion) => {
    const inKilos = portion.grams >= 1000 && portion.grams % 10 === 0;

    return {
      key: newKey(),
      amount: String(inKilos ? portion.grams / 1000 : portion.grams),
      unit: inKilos ? 'kg' : 'g',
      price: String(portion.price),
    };
  });
}

/** A new row with a size already filled in (one of the one-tap buttons) or empty. */
export function newPortionRow(grams?: number): PortionRow {
  if (!grams) return { key: newKey(), amount: '', unit: 'g', price: '' };

  return grams >= 1000 && grams % 1000 === 0
    ? { key: newKey(), amount: String(grams / 1000), unit: 'kg', price: '' }
    : { key: newKey(), amount: String(grams), unit: 'g', price: '' };
}

/** The weight of a row in grams; NaN while it is empty or not a number. */
export function rowGrams(row: PortionRow) {
  const amount = parseFloat(row.amount.replace(',', '.'));

  return Math.round(row.unit === 'kg' ? amount * 1000 : amount);
}

/** What is sent to the server. The server checks every value again. */
export function portionsFromRows(rows: PortionRow[]) {
  return rows.map((row) => ({ grams: rowGrams(row), price: parseFloat(row.price) }));
}

/**
 * "Sell by weight" for a food dish: the seller adds the sizes (250 g, 375 g, 500 g, 750 g, 1 kg ...) with a price for each,
 * and the customer picks one when ordering. Switched off, the dish has a single price like before.
 */
export default function PortionFields({
  enabled,
  onEnabledChange,
  rows,
  onRowsChange,
  idPrefix,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  rows: PortionRow[];
  onRowsChange: (rows: PortionRow[]) => void;
  idPrefix: string;
}) {
  const usedGrams = new Set(rows.map(rowGrams));
  const isFull = rows.length >= MAX_PORTIONS;

  const toggle = (checked: boolean) => {
    onEnabledChange(checked);
    // Switching it on starts with one empty line, so the seller sees where to type.
    if (checked && rows.length === 0) onRowsChange([newPortionRow()]);
  };

  const update = (key: string, change: Partial<PortionRow>) => {
    onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  };

  const addCommon = (grams: number) => {
    // A single empty line is replaced by the first one-tap choice.
    const withoutEmpty = rows.filter((row) => row.amount.trim() !== '' || row.price.trim() !== '');
    onRowsChange([...withoutEmpty, newPortionRow(grams)]);
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => toggle(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
          id={`${idPrefix}-by-weight`}
        />
        <span>
          <span className="block text-sm font-semibold text-ink">Sell by weight</span>
          <span className="block text-xs text-brand-gray">
            Add sizes like 250 g, 500 g or 1 kg, each with its own price. The customer picks one when ordering.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-brand-gray">Quick add</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_PORTION_GRAMS.map((grams) => (
                <button
                  key={grams}
                  type="button"
                  disabled={usedGrams.has(grams) || isFull}
                  onClick={() => addCommon(grams)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                  {formatPortion(grams)}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
                <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${idPrefix}-amount-${index}`} className="mb-1 block text-xs font-semibold text-brand-gray">
                      Size
                    </label>
                    <input
                      id={`${idPrefix}-amount-${index}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={row.amount}
                      onChange={(event) => update(row.key, { amount: event.target.value })}
                      placeholder="e.g. 500"
                      className={INPUT_CLASS}
                      required
                    />
                  </div>
                  <select
                    aria-label={`Unit of size ${index + 1}`}
                    value={row.unit}
                    onChange={(event) => update(row.key, { unit: event.target.value === 'kg' ? 'kg' : 'g' })}
                    className="w-20 shrink-0 rounded-xl border border-gray-300 bg-transparent px-2 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-red-100"
                  >
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label htmlFor={`${idPrefix}-price-${index}`} className="mb-1 block text-xs font-semibold text-brand-gray">
                    Price (PKR)
                  </label>
                  <input
                    id={`${idPrefix}-price-${index}`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={row.price}
                    onChange={(event) => update(row.key, { price: event.target.value })}
                    className={INPUT_CLASS}
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onRowsChange(rows.filter((candidate) => candidate.key !== row.key))}
                  disabled={rows.length <= 1}
                  className="mb-0.5 rounded-lg border border-gray-200 p-2 text-ink hover:border-red-600 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Remove size ${index + 1}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={isFull}
              onClick={() => onRowsChange([...rows, newPortionRow()])}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add another size
            </button>
            <p className="text-xs text-brand-gray">Up to {MAX_PORTIONS} sizes. The lowest price shows as &ldquo;From PKR &hellip;&rdquo;.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
