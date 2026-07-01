import { cacheLife, cacheTag } from 'next/cache';
import {
  buildBlogCategoryHref,
  findBlogCategoryLabelBySlug,
  getBlogCategorySlug,
} from '@/app/(storefront)/[slug]/(blog)/blog/blog-category-routing';
import { getBlogAuthorBySlug } from '@/lib/blog-authors';
import { getCachedBlogAuthor, getCachedBlogListing } from '@/lib/cached-data';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';

/**
 * Serializable status body for the blog **listing** routes, resolved before
 * React streaming so the proxy can emit real HTTP statuses. Mirrors the
 * `blog-post-status` body shape (#2883): `hasError` fails the caller open.
 */
export interface BlogListingStatusBody {
  hasError: boolean;
  redirectPath: string | null;
  /** `true` → 308 (category canonicalization); `false` → 307 (page clamp). */
  permanent: boolean;
  notFound: boolean;
}

/** Parsed intent the proxy derives from a listing pathname + query. */
export type BlogListingStatusIntent =
  | { kind: 'category-query'; category: string }
  | { kind: 'listing-page'; page: number; category?: string }
  | { kind: 'category-page'; categorySlug: string; page: number }
  | { kind: 'author'; authorSlug: string; page: number };

const FAIL_OPEN: BlogListingStatusBody = {
  hasError: true,
  redirectPath: null,
  permanent: false,
  notFound: false,
};
const NOOP: BlogListingStatusBody = {
  hasError: false,
  redirectPath: null,
  permanent: false,
  notFound: false,
};

function redirectBody(path: string, permanent: boolean): BlogListingStatusBody {
  const redirectPath = toSafeInternalRedirectPath(path);
  return redirectPath
    ? { hasError: false, redirectPath, permanent, notFound: false }
    : NOOP;
}

function withPage(basePath: string, page: number): string {
  return page > 1 ? `${basePath}?page=${page}` : basePath;
}

async function resolveCategoryQuery(
  lookupKey: string,
  rawCategory: string
): Promise<BlogListingStatusBody> {
  const category = rawCategory.trim();
  if (!category) {
    return NOOP;
  }
  const data = await getCachedBlogListing(lookupKey, { page: 1 });
  if (!data) {
    return NOOP;
  }
  const knownLabel = findBlogCategoryLabelBySlug(
    data.categories,
    getBlogCategorySlug(category)
  );
  if (!knownLabel) {
    return NOOP;
  }
  const href = buildBlogCategoryHref('', knownLabel, data.categories);
  // A colliding/non-clean category resolves back to a query URL — no clean
  // redirect target, so leave it for the route to render. Canonicalization is a
  // permanent (308) redirect.
  return href.includes('?') ? NOOP : redirectBody(href, true);
}

async function resolveListingPage(
  lookupKey: string,
  page: number,
  category: string | undefined
): Promise<BlogListingStatusBody> {
  const data = await getCachedBlogListing(lookupKey, {
    page,
    ...(category ? { category } : {}),
  });
  if (!data || page <= data.totalPages) {
    return NOOP;
  }
  if (category) {
    const knownLabel = findBlogCategoryLabelBySlug(
      data.categories,
      getBlogCategorySlug(category)
    );
    const href = knownLabel
      ? buildBlogCategoryHref('', knownLabel, data.categories)
      : '/blog';
    const cleanBase = href.includes('?') ? '/blog' : href;
    return redirectBody(withPage(cleanBase, data.totalPages), false);
  }
  return redirectBody(withPage('/blog', data.totalPages), false);
}

async function resolveCategoryPage(
  lookupKey: string,
  categorySlug: string,
  page: number
): Promise<BlogListingStatusBody> {
  const data = await getCachedBlogListing(lookupKey, { page: 1 });
  if (!data) {
    return NOOP;
  }
  const label = findBlogCategoryLabelBySlug(data.categories, categorySlug);
  if (!label) {
    // Unknown clean category — the route returns a real notFound() itself.
    return NOOP;
  }
  const categoryData = await getCachedBlogListing(lookupKey, {
    page,
    category: label,
  });
  if (!categoryData || page <= categoryData.totalPages) {
    return NOOP;
  }
  return redirectBody(
    withPage(`/blog/category/${categorySlug}`, categoryData.totalPages),
    false
  );
}

async function resolveAuthor(
  lookupKey: string,
  authorSlug: string,
  page: number
): Promise<BlogListingStatusBody> {
  const profile = getBlogAuthorBySlug(authorSlug, lookupKey);
  if (!profile) {
    // Unknown author is already resolved before the shell in the route.
    return NOOP;
  }
  const data = await getCachedBlogAuthor(lookupKey, profile.name, { page });
  if (!data) {
    // Known author with no published posts → real 404.
    return {
      hasError: false,
      redirectPath: null,
      permanent: false,
      notFound: true,
    };
  }
  if (page > data.totalPages) {
    return redirectBody(
      withPage(`/blog/author/${authorSlug}`, data.totalPages),
      false
    );
  }
  return NOOP;
}

/**
 * Resolve the hard status for a blog listing/category/author request. Reuses
 * the same cached, RLS-safe data the routes render from, so it never double-
 * fetches uncached data. Fails open (`hasError`) on any throw.
 */
export async function getCachedStorefrontBlogListingStatus(
  identifier: string,
  intent: BlogListingStatusIntent
): Promise<BlogListingStatusBody> {
  'use cache';
  cacheLife('blog');

  const lookupKey = identifier.trim().toLowerCase();
  cacheTag('blog-posts', `blog-listing-status-${lookupKey}`);
  if (!lookupKey) {
    return FAIL_OPEN;
  }

  try {
    switch (intent.kind) {
      case 'category-query':
        return await resolveCategoryQuery(lookupKey, intent.category);
      case 'listing-page':
        return await resolveListingPage(
          lookupKey,
          intent.page,
          intent.category
        );
      case 'category-page':
        return await resolveCategoryPage(
          lookupKey,
          intent.categorySlug,
          intent.page
        );
      case 'author':
        return await resolveAuthor(lookupKey, intent.authorSlug, intent.page);
      default:
        return NOOP;
    }
  } catch {
    return FAIL_OPEN;
  }
}
