export const FOOD_SPICE_LEVELS = ['MILD', 'MEDIUM', 'HOT'] as const;
export type FoodSpiceLevelKey = (typeof FOOD_SPICE_LEVELS)[number];

export const FOOD_DISH_TAGS = ['LIGHT', 'KIDS_FRIENDLY', 'VEGETARIAN'] as const;
export type FoodDishTag = (typeof FOOD_DISH_TAGS)[number];

export function parseFoodMetadata(spiceLevel: unknown, dishTags: unknown) {
  if (spiceLevel !== null && spiceLevel !== undefined && !FOOD_SPICE_LEVELS.includes(spiceLevel as FoodSpiceLevelKey)) {
    return { error: 'Choose a valid spice level.' } as const;
  }
  if (dishTags !== undefined && (!Array.isArray(dishTags) || dishTags.some((tag) => typeof tag !== 'string' || !FOOD_DISH_TAGS.includes(tag as FoodDishTag)))) {
    return { error: 'Choose valid dish tags.' } as const;
  }
  const cleanTags = [...new Set((dishTags as FoodDishTag[] | undefined) ?? [])];
  return { spiceLevel: (spiceLevel as FoodSpiceLevelKey | null | undefined) ?? null, dishTags: cleanTags } as const;
}

export const FOOD_DISH_TAG_LABELS: Record<FoodDishTag, string> = {
  LIGHT: 'Light meal',
  KIDS_FRIENDLY: 'Suitable for kids',
  VEGETARIAN: 'Vegetarian',
};
