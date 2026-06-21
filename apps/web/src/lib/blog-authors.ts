import { generateSlug } from '@/lib/seo-utils';

interface BlogAuthorProfile {
  /** The author's OWN personal/professional profile URLs. */
  sameAs: readonly string[];
}

/**
 * Canonical identity data for the small, stable set of named blog authors,
 * keyed by the author-name slug (`generateSlug(author_name)`).
 *
 * This holds only what is NOT denormalized onto `blog_posts` — each author's
 * personal `sameAs` profile links. These are the AUTHOR's own accounts, used on
 * the `Person` entity to disambiguate the individual. They are deliberately
 * distinct from the store's social media, which belongs on the `Organization`
 * entity (see `buildBlogPublisherSameAs`); conflating the two would be
 * inaccurate structured data.
 */
const BLOG_AUTHOR_PROFILES: Record<string, BlogAuthorProfile> = {
  'bassey-john': {
    sameAs: [
      'https://www.instagram.com/bassey__j',
      'https://www.linkedin.com/in/bassey-john-6a277885',
      'https://x.com/digitalogaa',
    ],
  },
  bolakale: {
    sameAs: [
      'https://www.instagram.com/earthmover007',
      'https://www.linkedin.com/in/michael-bolakale',
      'https://x.com/earthmover007',
    ],
  },
};

/**
 * Returns the personal `sameAs` profile URLs for a named blog author, or an
 * empty array when the author is unknown or unnamed.
 */
export function getBlogAuthorSameAs(
  authorName: string | null | undefined
): string[] {
  if (!authorName) {
    return [];
  }

  const profile = BLOG_AUTHOR_PROFILES[generateSlug(authorName)];
  return profile ? [...profile.sameAs] : [];
}
