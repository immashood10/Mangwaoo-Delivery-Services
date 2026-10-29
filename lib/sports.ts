// The Sports section (the "Sports" option of the top menu, `/sports`): sports gear is a MangwaooMart category, so sellers post
// it like any other product and customers buy it through the normal cart. This file holds the category's name and the quick
// "browse by sport" filters of the page. Client-safe.

/** The MangwaooMart category sports gear is posted under: a `Category` row (migration `sports_category`) and an entry of MART_CATEGORIES in lib/data.ts. */
export const SPORTS_CATEGORY = 'Sports';

export type SportFilter = {
  slug: string;
  name: string;
  icon: string;
  /** Words that find this sport's gear in a product's name or description (matched without regard to case). */
  words: string[];
};

export const SPORT_FILTERS: SportFilter[] = [
  { slug: 'cricket', name: 'Cricket', icon: '🏏', words: ['cricket', 'wicket', 'stumps'] },
  { slug: 'football', name: 'Football', icon: '⚽', words: ['football', 'soccer'] },
  { slug: 'badminton', name: 'Badminton', icon: '🏸', words: ['badminton', 'shuttle', 'racket', 'racquet'] },
  { slug: 'gym-fitness', name: 'Gym & Fitness', icon: '🏋️', words: ['gym', 'fitness', 'dumbbell', 'dumbell', 'weight', 'yoga', 'treadmill', 'protein'] },
  { slug: 'cycling', name: 'Cycling', icon: '🚴', words: ['cycle', 'cycling', 'bicycle'] },
  { slug: 'table-tennis', name: 'Table Tennis', icon: '🏓', words: ['table tennis', 'ping pong'] },
];

/** The filter named by the page's `?sport=` value, or null for anything else (all sports gear is shown then). */
export function findSportFilter(slug: string | undefined | null): SportFilter | null {
  return SPORT_FILTERS.find((filter) => filter.slug === slug) ?? null;
}

/**
 * Whether a product belongs to the sport: one of the sport's words starts a word in the text (a product's name and description).
 * Starting a word is what counts: "weight" is found in "weights" but not in "lightweight", "gym" not in "ergym".
 */
export function matchesSport(filter: SportFilter, text: string) {
  const haystack = text.toLowerCase();

  return filter.words.some((word) => {
    for (let index = haystack.indexOf(word); index !== -1; index = haystack.indexOf(word, index + 1)) {
      if (index === 0 || !/[a-z0-9]/.test(haystack[index - 1])) return true;
    }

    return false;
  });
}
