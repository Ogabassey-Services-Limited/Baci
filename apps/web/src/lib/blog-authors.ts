import { generateSlug } from '@/lib/seo-utils';

interface BlogAuthorProfile {
  /** Canonical display name (matches `blog_posts.author_name`). */
  name: string;
  /** The author's OWN personal/professional profile URLs. */
  sameAs: readonly string[];
}

/**
 * Canonical identity data for the small, stable set of named blog authors,
 * keyed by the author-name slug (`generateSlug(author_name)`).
 *
 * This holds what is NOT reliably derivable from `blog_posts` for the author
 * surface: the canonical name (so a `/blog/author/<slug>` route can resolve
 * back to `author_name`) and each author's personal `sameAs` profile links.
 * The `sameAs` URLs are the AUTHOR's own accounts, used on the `Person` entity
 * to disambiguate the individual. They are deliberately distinct from the
 * store's social media, which belongs on the `Organization` entity (see
 * `buildBlogPublisherSameAs`); conflating the two would be inaccurate
 * structured data. Title/bio/headshot stay denormalized on `blog_posts`.
 */
const BLOG_AUTHOR_PROFILES: Record<string, BlogAuthorProfile> = {
  'bassey-john': {
    name: 'Bassey John',
    sameAs: [
      'https://www.instagram.com/bassey__j',
      'https://www.linkedin.com/in/bassey-john-6a277885',
      'https://x.com/digitalogaa',
    ],
  },
  bolakale: {
    name: 'Bolakale',
    sameAs: [
      'https://www.instagram.com/earthmover007',
      'https://www.linkedin.com/in/michael-bolakale',
      'https://x.com/earthmover007',
    ],
  },
};

const OGABASSEY_AUTHOR_TENANT_IDENTIFIERS = new Set([
  'ogabassey',
  'ogabassey.com',
  'www.ogabassey.com',
]);

function canUseOgabasseyAuthorProfiles(
  tenantIdentifier: string | null | undefined
): boolean {
  return tenantIdentifier
    ? OGABASSEY_AUTHOR_TENANT_IDENTIFIERS.has(tenantIdentifier)
    : false;
}

/** Returns personal `sameAs` URLs for known OgaBassey authors only. */
export function getBlogAuthorSameAs(
  authorName: string | null | undefined,
  tenantIdentifier: string | null | undefined
): string[] {
  if (!authorName || !canUseOgabasseyAuthorProfiles(tenantIdentifier)) {
    return [];
  }

  const profile = BLOG_AUTHOR_PROFILES[generateSlug(authorName)];
  return profile ? [...profile.sameAs] : [];
}

/**
 * Resolves a `/blog/author/<slug>` route param to a known author's canonical
 * name + `sameAs`, or null when the slug has no author page.
 */
export function getBlogAuthorBySlug(
  slug: string,
  tenantIdentifier: string | null | undefined
): { name: string; sameAs: string[] } | null {
  if (!canUseOgabasseyAuthorProfiles(tenantIdentifier)) {
    return null;
  }

  const profile = BLOG_AUTHOR_PROFILES[slug];
  return profile ? { name: profile.name, sameAs: [...profile.sameAs] } : null;
}

/** Whether a named author has a dedicated author page (so a byline can link). */
export function hasBlogAuthorPage(
  authorName: string | null | undefined,
  tenantIdentifier: string | null | undefined
): boolean {
  if (!authorName || !canUseOgabasseyAuthorProfiles(tenantIdentifier)) {
    return false;
  }
  return generateSlug(authorName) in BLOG_AUTHOR_PROFILES;
}

/** All known author-page slugs (for `generateStaticParams`). */
export function getBlogAuthorSlugs(): string[] {
  return Object.keys(BLOG_AUTHOR_PROFILES);
}
