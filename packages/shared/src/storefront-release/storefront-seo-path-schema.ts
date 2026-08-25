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
        if (
          [...segment.matchAll(/%([0-9a-f]{2})/giu)].some((match) =>
            /^[a-z0-9._~-]$/iu.test(
              String.fromCharCode(Number.parseInt(match[1] ?? '', 16))
            )
          )
        )
          return false;
        let current = segment;
        for (let pass = 0; pass < 4; pass += 1) {
          const decoded = decodeURIComponent(current);
          if (
            decoded === '.' ||
            decoded === '..' ||
            decoded.includes('/') ||
            decoded.includes('\\') ||
            hasUnsafePathCharacter(decoded)
          )
            return false;
          if (decoded === current) return true;
          current = decoded;
        }
        return decodeURIComponent(current) === current;
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
