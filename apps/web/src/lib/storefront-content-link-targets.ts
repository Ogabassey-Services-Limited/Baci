import { normalizeStorefrontContentHref } from '@/lib/storefront-link-normalization';

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
// Legacy/imported HTML can carry valid unquoted hrefs (<a href=/blog/x>).
const UNQUOTED_HREF_ATTRIBUTE_REGEX = /\bhref\s*=\s*([^"'\s<>=][^\s<>]*)/gi;
// Reference-style Markdown definitions ([label]: /blog/x or <...>), which
// `marked` renders as anchors just like inline links.
// Markdown autolinks (<https://ogabassey.com/blog/x>) render as anchors too.
const MARKDOWN_AUTOLINK_REGEX = /<(https?:\/\/[^<>\s]+)>/gi;
const MARKDOWN_REFERENCE_DEFINITION_REGEX =
  /^[ \t]*\[[^\]\n]+\]:[ \t]*(<[^<>\s]+>|\S+)/gm;
const MARKDOWN_LINK_REGEX =
  /\]\(\s*(<[^<>\s]+>|[^()\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

// First segments that own real multi-segment static routes in the
// storefront app (e.g. /checkout/success, /pages/about, /account/orders,
// /sitemap/<id>, /blog/*, /api/*). A two-segment URL under these is a live
// app page, so it must never be classified as a product link — otherwise a
// coincidental dead product slug could unwrap it. Every OTHER two-segment
// path (including merchant categories that shadow single-segment utility
// pages like /repair or /returns) falls through to the
// [category]/[productSlug] PDP catch-all, so classifying it is safe:
// dead-set MEMBERSHIP decides, and only slugs that were collected, looked
// up, and confirmed dead can ever match.
const NON_PRODUCT_FIRST_SEGMENTS = new Set([
  'account',
  'api',
  'blog',
  'checkout',
  // /my-account/[...path] is a live catch-all (legacy account redirects).
  'my-account',
  'pages',
  'sitemap',
]);

// Bounds the `IN (...)` lookup queries; posts realistically contain far fewer
// internal links than this.
// UUID-shaped product identifiers (the PDP and the slug-resolution RPC both
// accept ids). Shared by dead-link classification and rewrite resolution so
// the two can never disagree on what counts as UUID-shaped.
export const UUID_SHAPED_PRODUCT_IDENTIFIER_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_COLLECTED_SLUGS_PER_KIND = 50;

// Blog utility routes that share the /blog/<segment> shape but are not
// posts (they must never be dead-checked or unwrapped). Extension-shaped
// segments (news-sitemap.xml, rss.xml, ...) are excluded generically.
const BLOG_UTILITY_SEGMENTS = new Set(['author', 'category']);
const FILE_EXTENSION_SEGMENT_REGEX = /\.[a-z0-9]+$/i;

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

function getPathSegments(pathname: string): string[] {
  return pathname
    .toLowerCase()
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.trim());
}

// Classify a path, retrying with a legacy `/<merchantSlug>/` prefix stripped
// ONLY when the unstripped form does not classify. The fallback order matters:
// a merchant whose slug doubles as a real category (e.g. a store slugged
// `smartphones` linking /smartphones/<product>) must classify unstripped,
// while path-mode links like /ogabassey/audio/<product> only classify after
// the prefix is removed.
function classifyPathSegments(
  pathname: string,
  merchantSlug?: string
): { kind: 'blog' | 'product'; slug: string } | null {
  const segments = getPathSegments(pathname);
  const direct = classifySegments(segments);
  if (direct) {
    return direct;
  }

  if (merchantSlug && segments[0] === merchantSlug.toLowerCase()) {
    return classifySegments(segments.slice(1));
  }

  return null;
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
    if (
      BLOG_UTILITY_SEGMENTS.has(second) ||
      FILE_EXTENSION_SEGMENT_REGEX.test(second)
    ) {
      return null;
    }
    return { kind: 'blog', slug: second };
  }

  if (first === 'products') {
    return { kind: 'product', slug: second };
  }

  if (SLUG_REGEX.test(first) && !NON_PRODUCT_FIRST_SEGMENTS.has(first)) {
    return { kind: 'product', slug: second };
  }

  return null;
}

function collectHrefCandidates(contentStr: string): string[] {
  const candidates: string[] = [];

  for (const regex of [
    HREF_ATTRIBUTE_REGEX,
    UNQUOTED_HREF_ATTRIBUTE_REGEX,
    MARKDOWN_LINK_REGEX,
    MARKDOWN_REFERENCE_DEFINITION_REGEX,
    MARKDOWN_AUTOLINK_REGEX,
  ]) {
    regex.lastIndex = 0;
    let match = regex.exec(contentStr);
    while (match !== null) {
      const captured = match[1];
      candidates.push(
        captured.startsWith('<') && captured.endsWith('>')
          ? captured.slice(1, -1)
          : captured
      );
      match = regex.exec(contentStr);
    }
  }

  return candidates;
}

export function collectStorefrontContentLinkTargets(
  contentStr: string,
  merchantSlug?: string,
  baseUrl?: string
): StorefrontContentLinkTargets {
  const blogSlugs = new Set<string>();
  const productSlugs = new Set<string>();

  if (contentStr) {
    for (const href of collectHrefCandidates(contentStr)) {
      // Normalize first so candidates match the canonical form the renderer
      // emits: legacy alias segments (`/phones/x`), category-prefix shapes
      // (`/categories/<cat>/<slug>`, `/category/...`, `/product-category/...`)
      // and merchant-domain absolute URLs all collapse to `/<category>/<slug>`
      // before classification. `baseUrl` matters on custom domains whose
      // hostname does not contain the merchant slug — without it absolute
      // same-site URLs would be skipped as external.
      const normalizedHref = normalizeStorefrontContentHref(href, {
        baseUrl,
        merchantSlug,
      });
      // Hrefs that stay non-root-relative after normalization are external
      // (or unparseable) — never candidates for internal liveness checks.
      if (!normalizedHref.startsWith('/') || normalizedHref.startsWith('//')) {
        continue;
      }
      const pathname = extractPathname(normalizedHref);
      if (!pathname) continue;

      const classified = classifyPathSegments(pathname, merchantSlug);
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

/**
 * Classifies a normalized internal pathname as a blog-post or product link
 * candidate. Shared with `storefront-content-link-rewriting.ts` so rewriting
 * and dead-link matching classify identically.
 */
export function classifyStorefrontContentPath(
  pathname: string,
  merchantSlug?: string
): { kind: 'blog' | 'product'; slug: string } | null {
  return classifyPathSegments(pathname, merchantSlug);
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
 *
 * Classification uses the same broad mode as collection so dead links under
 * merchant-defined categories (`/audio/x`, `/macbook/x`, …) actually unwrap.
 * That stays safe because membership decides: the dead sets only ever contain
 * slugs that were collected, validated against the database, and confirmed
 * dead — an href under a non-catalog segment can classify as a candidate but
 * can never match a dead entry that wasn't collected the same way.
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

  const classified = classifyPathSegments(pathname);
  if (!classified) {
    return false;
  }

  return classified.kind === 'blog'
    ? options.deadBlogSlugs.has(classified.slug)
    : options.deadProductSlugs.has(classified.slug);
}
