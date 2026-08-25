import { z } from 'zod';

function isNormalizedLocalPathname(value: string): boolean {
  const hasUnsafePathCharacter = (candidate: string) =>
    Array.from(candidate).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 32 || codePoint === 127;
    });
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\') ||
    (value.length > 1 && (value.endsWith('/') || value.includes('//'))) ||
    hasUnsafePathCharacter(value)
  )
    return false;
  try {
    return value
      .split('/')
      .slice(1)
      .every((segment) => {
        const decoded = decodeURIComponent(segment);
        return (
          decoded !== '.' &&
          decoded !== '..' &&
          !decoded.includes('/') &&
          !decoded.includes('\\') &&
          !hasUnsafePathCharacter(decoded)
        );
      });
  } catch {
    return false;
  }
}

/** Canonical root-relative path accepted by storefront SEO release entries. */
export const StorefrontSeoPathSchema = z
  .string()
  .max(2_048)
  .refine(isNormalizedLocalPathname, 'Expected a normalized local pathname');
