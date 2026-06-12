// Matches volatile imported copy such as "current listed price is NGN 2,500,000"
// and ranges like "the current listed price is ₦100 - 200". The prefix
// capture preserves sentence and HTML tag boundaries, currency handles NGN/₦/N
// variants, range separators cover -, –, —, and "to", and /gi strips every
// case-insensitive occurrence in a description.
const VOLATILE_LISTED_PRICE_SENTENCE_REGEX =
  /(^|[.!?]\s+|\s+|>)(?:the\s+)?current\s+listed\s+price\s+is\s+(?:NGN|₦|N)?\s*[\d,.]+(?:\s*(?:-|–|—|to)\s*(?:NGN|₦|N)?\s*[\d,.]+)?\s*\.?(?=\s|<|$)/gi;
const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
const SPACE_BEFORE_SENTENCE_PUNCTUATION_REGEX = /\s+([.!?])/g;

export function stripVolatileProductPriceSentences(
  value: string | null | undefined
): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }

  return value
    .replace(VOLATILE_LISTED_PRICE_SENTENCE_REGEX, (_match, prefix: string) =>
      // Keep the ">" boundary so HTML-wrapped copy remains valid, for example
      // "<p>Current listed price is NGN 100.</p>" becomes "<p></p>".
      /^\s*$/.test(prefix) ? '' : prefix
    )
    .replace(MULTIPLE_WHITESPACE_REGEX, ' ')
    .replace(SPACE_BEFORE_SENTENCE_PUNCTUATION_REGEX, '$1')
    .trim();
}
