export function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getFirstNonBlankString(...values: unknown[]): string {
  for (const value of values) {
    const trimmed = trimString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}
