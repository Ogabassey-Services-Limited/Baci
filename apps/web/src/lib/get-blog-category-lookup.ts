import { normalizeStorefrontCategoryValue } from '@/lib/normalize-storefront-category-value';

export interface BlogCategoryLookup {
  candidates: string[];
  canonicalFilter: string;
  canonicalSlugs: string[];
}

export function getBlogCategoryLookup(
  categorySlugs: readonly string[]
): BlogCategoryLookup {
  const candidates = new Set<string>();
  const canonicalSlugs = Array.from(
    new Set(
      categorySlugs
        .map((categorySlug) => normalizeStorefrontCategoryValue(categorySlug))
        .filter((categorySlug): categorySlug is string => Boolean(categorySlug))
    )
  );
  const patterns = new Set<string>();

  for (const value of categorySlugs) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const spaced = trimmed.replace(/[-_]+/gu, ' ');
    const titleCased = spaced.replace(
      /(^|\s)([a-z])/giu,
      (_match, prefix: string, character: string) =>
        `${prefix}${character.toUpperCase()}`
    );

    for (const candidate of [
      trimmed,
      trimmed.toLowerCase(),
      spaced,
      titleCased,
    ]) {
      if (candidate.length > 0) candidates.add(candidate);
    }
  }

  for (const canonicalSlug of canonicalSlugs) {
    const words = canonicalSlug.split('-').filter(Boolean);
    if (words.length === 0) continue;

    const addPattern = (parts: readonly string[]) => {
      patterns.add(`category.ilike.*${parts.join('*')}*`);
    };

    addPattern(words);
    // A category label may contain more than one punctuation boundary (for
    // example "Women's & Children's Fashion"). A wildcard between every
    // character keeps one bounded PostgREST pattern that can match those
    // separators; the caller still canonicalizes and verifies returned rows.
    addPattern(words.map((word) => word.split('').join('*')));
    words.forEach((word, wordIndex) => {
      for (let splitIndex = 1; splitIndex < word.length; splitIndex += 1) {
        const splitWords = [...words];
        splitWords[wordIndex] = `${word.slice(0, splitIndex)}*${word.slice(
          splitIndex
        )}`;
        addPattern(splitWords);
      }
    });
  }

  return {
    candidates: Array.from(candidates),
    canonicalFilter: Array.from(patterns).join(','),
    canonicalSlugs,
  };
}
