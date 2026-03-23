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

      const isAllLowercase = part === part.toLocaleLowerCase();
      const isAllUppercase = part === part.toLocaleUpperCase();
      const startsWithUppercase =
        part.charAt(0) !== part.charAt(0).toLocaleLowerCase();

      if (!isAllLowercase && !isAllUppercase && startsWithUppercase) {
        return part;
      }

      const normalizedPart = part.toLocaleLowerCase();
      return (
        normalizedPart.charAt(0).toLocaleUpperCase() + normalizedPart.slice(1)
      );
    })
    .join('');
}
