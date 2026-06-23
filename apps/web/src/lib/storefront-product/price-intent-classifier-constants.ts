export const PRICE_INTENT_PATTERN =
  /\b(price|prices|cost|rate|rates|how\s+much)\b/i;
export const STORAGE_PATTERN = /\b\d{1,4}\s?(?:gb|tb|mb)\b/gi;
export const STORAGE_TOKEN_PATTERN = /^\d{1,4}(?:gb|tb|mb)$/;
export const UK_USED_PATTERN = /\b(?:uk\s*used|uk-used|tokunbo)\b/i;
export const USED_PATTERN = /\bused\b/i;

export const HUB_CATEGORY_WORDS = new Map([
  ['phone', 'smartphones'],
  ['phones', 'smartphones'],
  ['smartphone', 'smartphones'],
  ['smartphones', 'smartphones'],
  ['laptop', 'laptops'],
  ['laptops', 'laptops'],
  ['tablet', 'tablets'],
  ['tablets', 'tablets'],
  ['drone', 'drones'],
  ['drones', 'drones'],
]);

export const BASE_STOP_TOKENS = new Set(
  'a an and buy cost for how in is much of phone phones price prices rate rates the'.split(
    ' '
  )
);

export const CONDITION_TOKENS = new Set('uk used tokunbo'.split(' '));
export const OPTIONAL_EXACT_TOKENS = new Set(
  '4g 5g galaxy lte sim dual'.split(' ')
);
export const GENERIC_HUB_TOKENS = new Set(
  'air max mini plus pro ultra lite se'.split(' ')
);
