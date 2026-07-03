import { unstable_rethrow } from 'next/navigation';
import { hasBlogAuthorPage } from '@/lib/blog-authors';
import { getCachedBlogPost } from '@/lib/cached-data';
import { generateSlug } from '@/lib/seo-utils';
import { isDomainIdentifier } from '@/lib/validation';
import type { BlogPostHeaderProps } from './BlogPostHeader';

export interface BlogPostHeroShell {
  /** `${basePath}/blog` — powers the breadcrumb and footer "back" links. */
  blogHref: string;
  header: BlogPostHeaderProps;
  hero: { alt: string; src: string };
}

/**
 * Resolve the cached, published blog post into the props needed to render the
 * hero + header in the static shell (the page root's hero-hoist path).
 *
 * Cached-only (`getCachedBlogPost`), so it is safe to await at the page root
 * without forcing the route dynamic — the exact same lookup `generateMetadata`
 * uses. Returns `null` for missing / draft-only / retired posts and for
 * published posts without a featured image, so the caller falls back to the
 * full-Suspense render (unchanged proxy-404 and draft-preview contracts).
 *
 * `authorHref` uses a request-header-free base path (derived from `slug`) and
 * `locale` is intentionally omitted — the page root cannot read `headers()`
 * without breaking the static shell. The streamed body still resolves the
 * header-accurate byline prefix and locale for its own structured data.
 */
export async function resolveBlogPostHeroShell(
  slug: string,
  postSlug: string
): Promise<BlogPostHeroShell | null> {
  // Over-long / repeatedly-encoded bot slugs can never match a post; bail
  // before the `'use cache'` getCachedBlogPost lookup runs with an unbounded
  // key (its cache key + tag both include the raw postSlug) — see #2923.
  if (!evaluateStorefrontSlugSafety(postSlug).safe) {
    return null;
  }

  let data: Awaited<ReturnType<typeof getCachedBlogPost>> = null;
  try {
    data = await getCachedBlogPost(slug, postSlug, false);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Error fetching cached blog hero shell', {
      slug,
      postSlug,
      error,
    });
    return null;
  }

  if (!data) {
    return null;
  }

  const { merchant, post } = data;
  const heroSrc = post.featured_image_url?.trim();
  if (!heroSrc) {
    return null;
  }

  const basePath = isDomainIdentifier(slug) ? '' : `/${slug}`;
  const hasAuthorHub = Boolean(
    post.author_name && hasBlogAuthorPage(post.author_name, merchant.slug)
  );
  const authorSlug =
    hasAuthorHub && post.author_name ? generateSlug(post.author_name) : null;

  return {
    blogHref: `${basePath}/blog`,
    hero: {
      alt: post.featured_image_alt || post.title,
      src: heroSrc,
    },
    header: {
      author_bio: post.author_bio,
      author_name: post.author_name,
      author_title: post.author_title,
      authorHref: authorSlug
        ? `${basePath}/blog/author/${authorSlug}`
        : undefined,
      category: post.category,
      published_at: post.published_at,
      reading_time_minutes: post.reading_time_minutes,
      title: post.title,
    },
  };
}
