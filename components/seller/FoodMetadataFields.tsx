'use client';

import { FOOD_DISH_TAG_LABELS, FOOD_DISH_TAGS, FOOD_SPICE_LEVELS, type FoodDishTag, type FoodSpiceLevelKey } from '@/lib/food-ai-metadata';

export default function FoodMetadataFields({
  idPrefix,
  spiceLevel,
  dishTags,
  onSpiceChange,
  onTagsChange,
}: {
  idPrefix: string;
  spiceLevel: FoodSpiceLevelKey | null;
  dishTags: FoodDishTag[];
  onSpiceChange: (value: FoodSpiceLevelKey | null) => void;
  onTagsChange: (value: FoodDishTag[]) => void;
}) {
  const inputClass = 'rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-ink';

  return (
    <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-ink">Food details for search and recommendations</legend>
      <label className="block text-sm text-ink">
        Spice level
        <select
          id={`${idPrefix}-spice`}
          value={spiceLevel ?? ''}
          onChange={(event) => onSpiceChange((event.target.value || null) as FoodSpiceLevelKey | null)}
          className={`mt-1 block w-full ${inputClass}`}
        >
          <option value="">Not specified</option>
          {FOOD_SPICE_LEVELS.map((level) => <option key={level} value={level}>{level.charAt(0) + level.slice(1).toLowerCase()}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {FOOD_DISH_TAGS.map((tag) => (
          <label key={tag} className="inline-flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={dishTags.includes(tag)}
              onChange={(event) => onTagsChange(event.target.checked ? [...dishTags, tag] : dishTags.filter((current) => current !== tag))}
              className="accent-red-700"
            />
            {FOOD_DISH_TAG_LABELS[tag]}
          </label>
        ))}
      </div>
      <p className="text-xs text-brand-gray">Only choose details that accurately describe this dish. Customers may filter by them.</p>
    </fieldset>
  );
}
