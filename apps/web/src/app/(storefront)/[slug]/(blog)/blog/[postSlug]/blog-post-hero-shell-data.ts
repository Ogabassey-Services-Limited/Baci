import { unstable_rethrow } from 'next/navigation';
import { hasBlogAuthorPage } from '@/lib/blog-authors';
import { getRequestScopedBlogPost } from '@/lib/cached-data';
import { generateSlug } from '@/lib/seo-utils';
import { evaluateStorefrontSlugSafety } from '@/lib/storefront-slug-safety';
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
 * Cached-only (`getRequestScopedBlogPost`), so it is safe to await at the page
 * root without forcing the route dynamic — the exact same request-scoped
 * lookup `generateMetadata` uses (deduped via React cache(), so this reuses
 * that Promise instead of a second Supabase round-trip). Returns `null` for
 * missing / draft-only / retired posts and for
 * published posts without a featured image, so the caller falls back to the
 * full-Suspense render (unchanged proxy-404 and draft-preview contracts).
 *
 * The fast path is restricted to CUSTOM-DOMAIN tenants (`isDomainIdentifier`).
 * The static shell cannot read request headers, so it cannot distinguish a
 * subdomain-mode tenant (`shop.usebaci.com`, which the proxy rewrites to
 * `/shop/blog/...`) from a path-mode one: a `/${slug}`-prefixed link would be
 * wrong on the public subdomain URL. A custom-domain tenant's link base is
 * unambiguously `''` on its own public URL, so those links are always correct —
 * and this still covers the perf target, `ogabassey.com`. Non-domain slugs
 * return `null` up front and fall back to the full-Suspense path, which
 * computes header-accurate links.
 *
 * `locale` is intentionally omitted — the page root cannot read `headers()`
 * without breaking the static shell. The streamed body still resolves the
 * header-accurate byline prefix and locale for its own structured data.
 * Accepted cost: a non-default-locale visitor may briefly see a default-locale
 * date string in the static shell (the streamed body remains locale-accurate).
 * This is a deliberate part of the static-shell contract, not a bug — do not
 * "fix" it by reading request headers here (that would force the route dynamic).
 */
export async function resolveBlogPostHeroShell(
  slug: string,
  postSlug: string
): Promise<BlogPostHeroShell | null> {
  if (!isDomainIdentifier(slug)) {
    return null;
  }

  // Over-long / repeatedly-encoded bot slugs can never match a post; bail
  // before the `'use cache'` getCachedBlogPost lookup runs with an unbounded
  // key (its cache key + tag both include the raw postSlug) — see #2923.
  if (!evaluateStorefrontSlugSafety(postSlug).safe) {
    return null;
  }

  let data: Awaited<ReturnType<typeof getRequestScopedBlogPost>> = null;
  try {
    data = await getRequestScopedBlogPost(slug, postSlug, false);
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

  // Custom-domain tenant: the public URL is rooted at the domain, so the link
  // base is always '' (guaranteed by the isDomainIdentifier gate above).
  const hasAuthorHub = Boolean(
    post.author_name && hasBlogAuthorPage(post.author_name, merchant.slug)
  );
  const authorSlug =
    hasAuthorHub && post.author_name ? generateSlug(post.author_name) : null;

  return {
    blogHref: '/blog',
    hero: {
      alt: post.featured_image_alt || post.title,
      src: heroSrc,
    },
    header: {
      author_bio: post.author_bio,
      author_name: post.author_name,
      author_title: post.author_title,
      authorHref: authorSlug ? `/blog/author/${authorSlug}` : undefined,
      category: post.category,
      published_at: post.published_at,
      reading_time_minutes: post.reading_time_minutes,
      title: post.title,
    },
  };
}
