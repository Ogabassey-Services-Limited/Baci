const BLOG_INDEX_PREFIXES = new Set(['category', 'tag']);
const BLOG_INDEX_EXACT_SEGMENTS = new Set(['search', 'search.php']);
const BLOG_SPAM_KEYWORDS = ['shopdetail', 'surugaya', 'wp-', 'zhhant', '.html'];
const YEAR_SEGMENT_REGEX = /^(19|20)\d{2}$/;
const NUMERIC_SEGMENT_REGEX = /^\d+$/;

export type LegacyBlogPathResolution =
  | { type: 'sitemap' }
  | { type: 'post-alias'; candidatePostSlug: string }
  | { type: 'invalid' };

export function resolveLegacyBlogPath(
  segments: string[]
): LegacyBlogPathResolution {
  const normalizedSegments = segments.map((segment) =>
    decodeURIComponent(segment).toLowerCase()
  );

  if (
    normalizedSegments.length === 1 &&
    normalizedSegments[0] === 'sitemap.xml'
  ) {
    return { type: 'sitemap' };
  }

  if (
    normalizedSegments.some((segment) =>
      BLOG_SPAM_KEYWORDS.some((keyword) => segment.includes(keyword))
    )
  ) {
    return { type: 'invalid' };
  }

  const firstSegment = normalizedSegments[0];
  if (
    BLOG_INDEX_PREFIXES.has(firstSegment) ||
    BLOG_INDEX_EXACT_SEGMENTS.has(firstSegment)
  ) {
    return { type: 'invalid' };
  }

  const lastSegment = normalizedSegments.at(-1);
  if (!lastSegment) {
    return { type: 'invalid' };
  }

  if (lastSegment === 'feed') {
    return { type: 'invalid' };
  }

  if (
    YEAR_SEGMENT_REGEX.test(firstSegment) &&
    normalizedSegments.length >= 4 &&
    NUMERIC_SEGMENT_REGEX.test(normalizedSegments[1]) &&
    NUMERIC_SEGMENT_REGEX.test(normalizedSegments[2])
  ) {
    return { type: 'post-alias', candidatePostSlug: lastSegment };
  }

  if (
    YEAR_SEGMENT_REGEX.test(firstSegment) ||
    NUMERIC_SEGMENT_REGEX.test(lastSegment)
  ) {
    return { type: 'invalid' };
  }

  if (normalizedSegments.length >= 2) {
    return { type: 'post-alias', candidatePostSlug: lastSegment };
  }

  return { type: 'invalid' };
}
