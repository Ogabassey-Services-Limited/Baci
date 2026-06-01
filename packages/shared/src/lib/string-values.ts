export function getFirstNonBlankString(
  ...values: unknown[]
): string {
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}
