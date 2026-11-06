export const ESSENTIAL_CATEGORIES = ['groceries', 'dairy', 'medicine', 'fruits', 'vegetables', 'household', 'snacks', 'beverages', 'personal care', 'meat', 'seafood'];
export function isEssentialCategory(name: string) { const lower = name.toLowerCase(); return ESSENTIAL_CATEGORIES.some(category => lower.includes(category)); }
