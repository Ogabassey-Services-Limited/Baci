// Matches volatile imported copy such as "current listed price is NGN 2,500,000"
// and ranges like "the current listed price is ₦100 - 200". The prefix
// capture preserves sentence and HTML tag boundaries, currency handles NGN/₦/N
// variants, range separators cover -, –, —, and "to". The second pattern covers
// imported rich text where only the price amount is wrapped by inline tags.
const LISTED_PRICE_SENTENCE_PREFIX_REGEX_PART = '(^|[.!?]\\s+|\\s+|>)';
const LISTED_PRICE_AMOUNT_REGEX_PART =
  '(?:NGN|₦|N)?\\s*[\\d,.]+(?:\\s*(?:-|–|—|to)\\s*(?:NGN|₦|N)?\\s*[\\d,.]+)?';
const VOLATILE_LISTED_PRICE_SENTENCE_REGEX = new RegExp(
  `${LISTED_PRICE_SENTENCE_PREFIX_REGEX_PART}(?:the\\s+)?current\\s+listed\\s+price\\s+is\\s+${LISTED_PRICE_AMOUNT_REGEX_PART}\\s*\\.?(?=\\s|<|$)`,
  'gi'
);
const INLINE_FORMATTING_TAG_NAME_REGEX_PART =
  '(?:a|b|code|em|i|mark|s|small|span|strong|u)';
const INLINE_FORMATTING_OPEN_TAGS_REGEX_PART = `(?:<${INLINE_FORMATTING_TAG_NAME_REGEX_PART}\\b[^>]*>\\s*)+`;
const INLINE_FORMATTING_CLOSE_TAGS_REGEX_PART = `(?:\\s*</${INLINE_FORMATTING_TAG_NAME_REGEX_PART}>)+`;
const VOLATILE_INLINE_FORMATTED_LISTED_PRICE_SENTENCE_REGEX = new RegExp(
  `${LISTED_PRICE_SENTENCE_PREFIX_REGEX_PART}(?:the\\s+)?current\\s+listed\\s+price\\s+is\\s+${INLINE_FORMATTING_OPEN_TAGS_REGEX_PART}${LISTED_PRICE_AMOUNT_REGEX_PART}${INLINE_FORMATTING_CLOSE_TAGS_REGEX_PART}\\s*\\.?(?=\\s|<|$)`,
  'gi'
);
const MULTIPLE_WHITESPACE_REGEX = /\s+/g;
const SPACE_BEFORE_SENTENCE_PUNCTUATION_REGEX = /\s+([.!?])/g;

function preserveSentenceBoundary(_match: string, prefix: string): string {
  // Keep the ">" boundary so HTML-wrapped copy remains valid, for example
  // "<p>Current listed price is NGN 100.</p>" becomes "<p></p>".
  return /^\s*$/.test(prefix) ? '' : prefix;
}

export function stripVolatileProductPriceSentences(
  value: string | null | undefined
): string {
  if (typeof value !== 'string' || value.length === 0) {
    return '';
  }

  return value
    .replace(
      VOLATILE_INLINE_FORMATTED_LISTED_PRICE_SENTENCE_REGEX,
      preserveSentenceBoundary
    )
    .replace(VOLATILE_LISTED_PRICE_SENTENCE_REGEX, preserveSentenceBoundary)
    .replace(MULTIPLE_WHITESPACE_REGEX, ' ')
    .replace(SPACE_BEFORE_SENTENCE_PUNCTUATION_REGEX, '$1')
    .trim();
}
