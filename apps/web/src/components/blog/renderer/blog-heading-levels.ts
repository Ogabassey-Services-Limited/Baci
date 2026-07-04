export const HEADING_SIZE_CLASSES: Record<number, string> = {
  1: 'text-4xl font-bold mt-12 mb-6',
  2: 'text-3xl font-bold mt-10 mb-5',
  3: 'text-2xl font-bold mt-8 mb-4',
  4: 'text-xl font-bold mt-6 mb-3',
};

export function normalizeSourceHeadingLevel(level: unknown): number {
  const parsedLevel = Number(level);
  if (!Number.isFinite(parsedLevel)) {
    return 1;
  }
  return Math.min(Math.max(Math.trunc(parsedLevel), 1), 6);
}

/**
 * Blog body headings render one level below their authored level (the post
 * title owns the page's h1), clamped to the h2-h6 range.
 */
export function getBlogBodyHeadingLevel(
  sourceLevel: number
): 2 | 3 | 4 | 5 | 6 {
  return Math.max(Math.min(sourceLevel + 1, 6), 2) as 2 | 3 | 4 | 5 | 6;
}
