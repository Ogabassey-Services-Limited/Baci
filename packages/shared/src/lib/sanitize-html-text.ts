const HTML_TAG_REGEX = /<[^>]{0,1000}>/g;
const UNBOUNDED_HTML_TAG_REGEX = /<[^>]*>/g;
const ANGLE_BRACKET_REGEX = /[<>]/g;
const NULL_BYTE_REGEX = /\0/g;
const WHITESPACE_REGEX = /\s+/g;
const BASIC_HTML_ENTITY_REGEX = /&(nbsp|lt|gt|quot|amp|#039|#39|apos);/gi;

const BASIC_HTML_ENTITIES: Record<string, string> = {
  '#039': "'",
  '#39': "'",
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function stripHtmlTags(value: string) {
  if (!value.includes('<')) {
    return value;
  }

  let result = value;
  let previous: string;
  let iterations = 0;

  do {
    previous = result;
    result = result.replace(HTML_TAG_REGEX, ' ');
    iterations += 1;
  } while (result !== previous && iterations < 10);

  return result
    .replace(UNBOUNDED_HTML_TAG_REGEX, ' ')
    .replace(ANGLE_BRACKET_REGEX, ' ');
}

function decodeBasicHtmlEntities(value: string) {
  return value.replace(BASIC_HTML_ENTITY_REGEX, (entity) => {
    const key = entity.slice(1, -1).toLowerCase();
    return BASIC_HTML_ENTITIES[key] ?? entity;
  });
}

// Returns plain text for storage or further formatting. Callers that interpolate
// this value into HTML must still escape it at the render boundary.
export function sanitizeHtmlToPlainText(
  value: string | null | undefined,
  maxLength = 10_000
) {
  if (!value) {
    return '';
  }

  const cleaned = decodeBasicHtmlEntities(
    stripHtmlTags(value.replace(NULL_BYTE_REGEX, ''))
  )
    .replace(WHITESPACE_REGEX, ' ')
    .trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}
