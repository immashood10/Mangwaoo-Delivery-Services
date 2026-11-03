// A small picture (an emoji) for a food item, picked from its name: "Chicken Biryani" -> 🍛, "Vanilla Ice Cream" -> 🍦.
// Client-safe, no database. Sellers write names in their own words (English or Roman Urdu), so the match is on words in the
// name; the FIRST rule that matches wins, which is why the dishes ("biryani", "burger", "fried rice", "shake") come before
// the plain ingredients ("chicken", "chocolate"): a "Chicken Biryani" must not become a chicken leg.

export const GENERIC_FOOD_ICON = '🍽️';

const FOOD_ICON_RULES: { icon: string; words: string[] }[] = [
  { icon: '🍛', words: ['biryani', 'biriyani', 'pulao', 'pulav', 'pilau', 'karahi', 'qorma', 'korma', 'curry', 'haleem', 'nihari', 'handi', 'daal', 'dal', 'salan'] },
  { icon: '🍦', words: ['ice cream', 'icecream', 'kulfi', 'gelato', 'sundae', 'cone', 'softy'] },
  { icon: '🍧', words: ['falooda', 'gola', 'gola ganda', 'slush', 'shaved ice'] },
  { icon: '🍔', words: ['burger', 'zinger', 'patty', 'cheeseburger'] },
  { icon: '🍕', words: ['pizza', 'calzone'] },
  { icon: '🌯', words: ['shawarma', 'roll', 'wrap', 'burrito', 'paratha roll', 'kathi'] },
  { icon: '🥪', words: ['sandwich', 'sub', 'club', 'panini', 'toast'] },
  { icon: '🌭', words: ['hot dog', 'hotdog'] },
  { icon: '🍟', words: ['fries', 'french fries', 'wedges', 'nuggets'] },
  { icon: '🥟', words: ['momo', 'momos', 'dumpling', 'dumplings', 'samosa', 'samosas', 'spring roll', 'dim sum', 'gyoza'] },
  { icon: '🍝', words: ['pasta', 'spaghetti', 'macaroni', 'lasagna', 'lasagne', 'fettuccine', 'penne', 'alfredo'] },
  { icon: '🍜', words: ['noodle', 'noodles', 'chowmein', 'chow mein', 'ramen', 'soup', 'shorba', 'yakhni'] },
  { icon: '🥗', words: ['salad', 'raita', 'coleslaw'] },
  { icon: '🍚', words: ['rice', 'fried rice', 'chawal', 'khichdi'] },
  { icon: '🫓', words: ['naan', 'nan', 'roti', 'chapati', 'paratha', 'parantha', 'tandoori roti', 'kulcha', 'puri', 'bread'] },
  { icon: '🍳', words: ['egg', 'eggs', 'omelette', 'omelet', 'anda', 'breakfast'] },
  { icon: '🥘', words: ['paya', 'siri paye', 'kata kat', 'katakat', 'chana', 'channay', 'chole', 'nihari kulcha', 'lahori'] },
  { icon: '🍢', words: ['seekh', 'kebab', 'kabab', 'tikka', 'bbq', 'bar b q', 'barbecue', 'skewer', 'boti', 'malai boti', 'chapli'] },
  { icon: '🎂', words: ['cake', 'cupcake', 'cheesecake', 'gateau'] },
  { icon: '🍩', words: ['donut', 'doughnut'] },
  { icon: '🍪', words: ['cookie', 'cookies', 'biscuit', 'biscuits', 'brownie', 'brownies'] },
  { icon: '🥐', words: ['pastry', 'pastries', 'croissant', 'danish', 'patties', 'puff'] },
  { icon: '🍮', words: ['pudding', 'custard', 'kheer', 'caramel', 'flan', 'phirni', 'firni'] },
  { icon: '☕', words: ['coffee', 'latte', 'cappuccino', 'espresso', 'mocha', 'americano', 'chai', 'tea', 'kahwa', 'doodh patti'] },
  { icon: '🥤', words: ['shake', 'milkshake', 'smoothie', 'lassi', 'cola', 'pepsi', 'coke', 'sprite', 'fanta', '7up', 'soda', 'drink', 'drinks', 'mojito', 'lemonade', 'sharbat', 'rooh afza', 'cold drink'] },
  { icon: '🧃', words: ['juice', 'fresh juice', 'nimbu pani', 'ganna'] },
  { icon: '💧', words: ['water', 'mineral water'] },
  { icon: '🥛', words: ['milk', 'doodh', 'dahi', 'yogurt', 'yoghurt'] },
  { icon: '🍫', words: ['chocolate', 'choco', 'nutella'] },
  { icon: '🍗', words: ['broast', 'fried chicken', 'wings', 'drumstick', 'leg piece', 'chicken piece', 'chicken'] },
  { icon: '🥩', words: ['steak', 'beef', 'mutton', 'lamb', 'ribs', 'chops', 'chop'] },
  { icon: '🐟', words: ['fish', 'prawn', 'prawns', 'shrimp', 'seafood', 'crab'] },
  { icon: '🍬', words: ['mithai', 'sweet', 'sweets', 'halwa', 'gulab jamun', 'jalebi', 'barfi', 'burfi', 'ladoo', 'laddu', 'rasmalai', 'rasgulla', 'gajar'] },
  { icon: '🍉', words: ['fruit', 'fruits', 'watermelon', 'melon', 'chaat'] },
];

/** The words of a name, lower case, with hyphens and punctuation turned into single spaces. */
function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "(500 g)" and other size notes
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim();
}

const compiledRules = FOOD_ICON_RULES.map((rule) => ({
  icon: rule.icon,
  pattern: new RegExp(`(?:^| )(?:${rule.words.map((word) => word.replace(/[^a-z0-9 ]/g, '')).join('|')})(?:s|es)?(?: |$)`),
}));

/** The emoji for a food item's name, or a plate when nothing in the name is recognised. */
export function foodIconFor(name: string): string {
  const normalized = normalizeName(name);

  if (!normalized) return GENERIC_FOOD_ICON;

  return compiledRules.find((rule) => rule.pattern.test(normalized))?.icon ?? GENERIC_FOOD_ICON;
}
