const WORD_SEPARATOR_REGEX = /([\s'’-]+)/;
const WHITESPACE_REGEX = /\s+/g;

export function formatPersonName(value: string | null | undefined): string {
  const normalizedValue = value?.replace(WHITESPACE_REGEX, ' ').trim() || '';

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue
    .split(WORD_SEPARATOR_REGEX)
    .map((part) => {
      if (!part || WORD_SEPARATOR_REGEX.test(part)) {
        return part;
      }

      const lowerCased = part.toLocaleLowerCase();
      return lowerCased.charAt(0).toLocaleUpperCase() + lowerCased.slice(1);
    })
    .join('');
}
