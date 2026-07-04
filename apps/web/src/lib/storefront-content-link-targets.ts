import { STOREFRONT_CATEGORY_ALIASES } from '@/lib/normalize-storefront-category-slug';

/**
 * Helpers for validating internal storefront links found inside merchant
 * content (blog posts). Content is largely agent-generated and can reference
 * blog posts that are still drafts or products that were never created, so
 * the blog renderer collects candidate targets with
 * `collectStorefrontContentLinkTargets`, resolves which ones are live, and
 * unwraps dead anchors via `isDeadStorefrontContentHref`.
 */

// Matches href values in raw HTML (`href="..."`), TipTap JSON (`"href":"..."`)
// and markdown (`](...)`) without needing to know the content format upfront.
const HREF_ATTRIBUTE_REGEX = /\bhref\\?["']?\s*[:=]\s*\\?["']([^"'\\<>\s]+)/gi;
const MARKDOWN_LINK_REGEX = /\]\(([^()\s]+)\)/g;

// Category segments whose `/<category>/<slug>` links are validated as PDP
// links. Restricted to the platform alias table so unknown merchant-specific
// segments are never misclassified as product links.
const PRODUCT_CATEGORY_SEGMENTS = new Set<string>([
  ...Object.keys(STOREFRONT_CATEGORY_ALIASES),
  ...Object.values(STOREFRONT_CATEGORY_ALIASES),
]);

// Bounds the `IN (...)` lookup queries; posts realistically contain far fewer
// internal links than this.
const MAX_COLLECTED_SLUGS_PER_KIND = 50;

const SLUG_REGEX = /^[a-z0-9][a-z0-9._~-]*$/;

export interface StorefrontContentLinkTargets {
  blogSlugs: string[];
  productSlugs: string[];
}

export interface DeadStorefrontContentLinkSlugs {
  blog: string[];
  products: string[];
}

function extractPathname(href: string): string | null {
  try {
    return new URL(href, 'https://content.invalid').pathname;
  } catch {
    return null;
  }
}

function getPathSegments(pathname: string, merchantSlug?: string): string[] {
  const segments = pathname
    .toLowerCase()
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.trim());

  // Collapse a legacy `/<merchantSlug>/...` prefix so path-based storefront
  // links are classified the same way as root-relative ones.
  if (merchantSlug && segments[0] === merchantSlug.toLowerCase()) {
    return segments.slice(1);
  }

  return segments;
}

function classifySegments(
  segments: string[]
): { kind: 'blog' | 'product'; slug: string } | null {
  if (segments.length !== 2) {
    return null;
  }

  const [first, second] = segments;
  if (!SLUG_REGEX.test(second)) {
    return null;
  }

  if (first === 'blog') {
    return { kind: 'blog', slug: second };
  }

  if (first === 'products' || PRODUCT_CATEGORY_SEGMENTS.has(first)) {
    return { kind: 'product', slug: second };
  }

  return null;
}

function collectHrefCandidates(contentStr: string): string[] {
  const candidates: string[] = [];

  for (const regex of [HREF_ATTRIBUTE_REGEX, MARKDOWN_LINK_REGEX]) {
    regex.lastIndex = 0;
    let match = regex.exec(contentStr);
    while (match !== null) {
      candidates.push(match[1]);
      match = regex.exec(contentStr);
    }
  }

  return candidates;
}

export function collectStorefrontContentLinkTargets(
  contentStr: string,
  merchantSlug?: string
): StorefrontContentLinkTargets {
  const blogSlugs = new Set<string>();
  const productSlugs = new Set<string>();

  if (contentStr) {
    for (const href of collectHrefCandidates(contentStr)) {
      const pathname = extractPathname(href);
      if (!pathname) continue;

      const classified = classifySegments(
        getPathSegments(pathname, merchantSlug)
      );
      if (!classified) continue;

      if (classified.kind === 'blog') {
        blogSlugs.add(classified.slug);
      } else {
        productSlugs.add(classified.slug);
      }
    }
  }

  return {
    blogSlugs: Array.from(blogSlugs)
      .sort()
      .slice(0, MAX_COLLECTED_SLUGS_PER_KIND),
    productSlugs: Array.from(productSlugs)
      .sort()
      .slice(0, MAX_COLLECTED_SLUGS_PER_KIND),
  };
}

export interface IsDeadStorefrontContentHrefOptions {
  basePath?: string;
  deadBlogSlugs: ReadonlySet<string>;
  deadProductSlugs: ReadonlySet<string>;
}

/**
 * Returns true when a normalized internal href points at a blog post or
 * product known to be dead (draft/archived/nonexistent). Only root-relative
 * hrefs are considered — external URLs always return false.
 */
export function isDeadStorefrontContentHref(
  href: string,
  options: IsDeadStorefrontContentHrefOptions
): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) {
    return false;
  }

  if (options.deadBlogSlugs.size === 0 && options.deadProductSlugs.size === 0) {
    return false;
  }

  let pathname = href.split(/[?#]/)[0];

  const basePath = options.basePath?.replace(/\/+$/, '');
  if (basePath && basePath !== '/' && pathname.startsWith(`${basePath}/`)) {
    pathname = pathname.slice(basePath.length);
  }

  const classified = classifySegments(getPathSegments(pathname));
  if (!classified) {
    return false;
  }

  return classified.kind === 'blog'
    ? options.deadBlogSlugs.has(classified.slug)
    : options.deadProductSlugs.has(classified.slug);
}
