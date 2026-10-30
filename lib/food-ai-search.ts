import { Type, type Schema } from '@google/genai';
import { FOOD_DISH_TAGS, FOOD_SPICE_LEVELS, type FoodDishTag, type FoodSpiceLevelKey } from '@/lib/food-ai-metadata';
import { generateJson } from '@/lib/ai/provider';

export type FoodSearchIntent = {
  terms: string[];
  maxPrice: number | null;
  spice: FoodSpiceLevelKey[];
  tags: FoodDishTag[];
};

const EMPTY_INTENT: FoodSearchIntent = { terms: [], maxPrice: null, spice: [], tags: [] };
const STOP_WORDS = new Set(['mujhe', 'kuch', 'chahiye', 'koi', 'please', 'find', 'show', 'want', 'need', 'some', 'something', 'food', 'dish', 'khana', 'tak', 'under', 'upto', 'up', 'to', 'less', 'than', 'within', 'budget', 'rupees', 'rupee', 'pkr', 'rs', 'ka', 'ki', 'ke', 'liya', 'liye', 'for', 'the', 'and', 'with', 'halka', 'spicy', 'tez', 'teekha', 'teekhi', 'masalaydar', 'masaledar', 'mild', 'kids', 'children', 'bachon', 'bache', 'vegetarian', 'veg']);

function amountFrom(message: string) {
  const text = message.toLowerCase().replace(/,/g, '');
  const patterns = [
    /(?:under|upto|up to|less than|max(?:imum)?|budget|within|below)\s*(?:pkr|rs\.?|rupees?)?\s*(\d{2,6})/,
    /(\d{2,6})\s*(?:pkr|rs\.?|rupees?)?\s*(?:tak|max|maximum|under|ke andar)/,
    /(?:pkr|rs\.?|rupees?)\s*(\d{2,6})\s*(?:tak)?/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const amount = Number(match[1]);
      if (amount >= 50 && amount <= 100000) return amount;
    }
  }
  return null;
}

export function parseFoodSearch(message: string): FoodSearchIntent {
  const text = message.toLowerCase();
  const intent = { ...EMPTY_INTENT, spice: [] as FoodSpiceLevelKey[], tags: [] as FoodDishTag[] };
  intent.maxPrice = amountFrom(text);

  if (/\b(spicy|spice|hot|tez|teekha|teekhi|masalaydar|masaledar)\b/i.test(text)) intent.spice = ['MEDIUM', 'HOT'];
  else if (/\b(mild|less spicy|kam mirch|bilkul kam mirch)\b/i.test(text)) intent.spice = ['MILD'];

  if (/\b(light|halka|halka khana|easy meal)\b/i.test(text)) intent.tags.push('LIGHT');
  if (/\b(kids?|children|bachon|bache|bachay)\b/i.test(text)) intent.tags.push('KIDS_FRIENDLY');
  if (/\b(vegetarian|veggie|veg)\b/i.test(text)) intent.tags.push('VEGETARIAN');

  intent.terms = [...new Set(text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)))].slice(0, 6);
  return intent;
}

const intentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    terms: { type: Type.ARRAY, items: { type: Type.STRING } },
    maxPrice: { type: Type.NUMBER, nullable: true },
    spice: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...FOOD_SPICE_LEVELS] } },
    tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...FOOD_DISH_TAGS] } },
  },
  required: ['terms', 'maxPrice', 'spice', 'tags'],
};

/** Gemini translates ambiguous wording into filters only; the server validates them and fetches real dishes itself. */
export async function interpretFoodSearch(message: string, current: FoodSearchIntent): Promise<FoodSearchIntent> {
  if (current.maxPrice !== null || current.spice.length > 0 || current.tags.length > 0) return current;

  const parsed = await generateJson<Partial<FoodSearchIntent>>({
    system: 'Translate a food search into menu search filters. Return only structured filters. Do not invent item IDs, prices, stock, or products. Interpret English and Roman Urdu. Product tags may only be LIGHT, KIDS_FRIENDLY, VEGETARIAN; spice must be MILD, MEDIUM, or HOT.',
    prompt: message.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]').replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone]').slice(0, 500),
    schema: intentSchema,
  });

  if (!parsed || !Array.isArray(parsed.terms)) return current;
  const translatedTerms = [...new Set(parsed.terms.filter((term): term is string => typeof term === 'string').map((term) => term.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim()).filter((term) => term.length >= 2))].slice(0, 6);
  const aiMax = typeof parsed.maxPrice === 'number' && Number.isFinite(parsed.maxPrice) && parsed.maxPrice >= 50 && parsed.maxPrice <= 100000 ? Math.floor(parsed.maxPrice) : null;
  return {
    terms: translatedTerms.length ? translatedTerms : current.terms,
    maxPrice: aiMax ?? current.maxPrice,
    spice: Array.isArray(parsed.spice) ? [...new Set([...current.spice, ...parsed.spice.filter((value): value is FoodSpiceLevelKey => FOOD_SPICE_LEVELS.includes(value as FoodSpiceLevelKey))])] : current.spice,
    tags: Array.isArray(parsed.tags) ? [...new Set([...current.tags, ...parsed.tags.filter((value): value is FoodDishTag => FOOD_DISH_TAGS.includes(value as FoodDishTag))])] : current.tags,
  };
}

export function isOrderStatusQuestion(message: string) {
  return /\b(status|track|tracking|deliver(?:y|ed)?|rider|where.*order|order.*where|mera order|order kahan|order kidhar|order kab|mw-[mf]\d+)\b/i.test(message);
}

export function isFoodSearchQuestion(message: string) {
  const intent = parseFoodSearch(message);
  return intent.terms.length > 0 || intent.maxPrice !== null || intent.spice.length > 0 || intent.tags.length > 0 ||
    /\b(food|dish|biryani|burger|pizza|roll|pulao|rice|bacha|bachon|halka|kuch khana|kya khau)\b/i.test(message);
}
