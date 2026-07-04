import {
  rewriteStorefrontContentHref,
  type StorefrontContentLinkRewrites,
} from '@/lib/storefront-content-link-rewriting';
import { isDeadStorefrontContentHref } from '@/lib/storefront-content-link-targets';

export interface RenderedInternalLinkResolution {
  /** The href to render: canonical rewrite when one applies, else the input. */
  href: string;
  /** True when the link targets a confirmed-dead internal blog post/product. */
  isDead: boolean;
}

/**
 * Pure resolution for a normalized root-relative content href at render time:
 * canonicalize links whose target resolves via a permanent redirect (renamed
 * post, consolidated/re-categorized product) first — a rewritten link is live
 * by construction — then check the remaining href against the confirmed-dead
 * sets. Non-relative hrefs pass through untouched and are never dead.
 */
export function resolveRenderedInternalLink(
  normalizedHref: string,
  options: {
    basePath?: string;
    contentLinkRewrites?: StorefrontContentLinkRewrites;
    deadBlogSlugs?: ReadonlySet<string>;
    deadProductSlugs?: ReadonlySet<string>;
  }
): RenderedInternalLinkResolution {
  const isRelative =
    normalizedHref.startsWith('/') && !normalizedHref.startsWith('//');

  if (!isRelative) {
    return { href: normalizedHref, isDead: false };
  }

  const rewrittenHref = options.contentLinkRewrites
    ? rewriteStorefrontContentHref(normalizedHref, {
        basePath: options.basePath,
        rewrites: options.contentLinkRewrites,
      })
    : null;

  if (rewrittenHref) {
    return { href: rewrittenHref, isDead: false };
  }

  const isDead =
    !!(options.deadBlogSlugs || options.deadProductSlugs) &&
    isDeadStorefrontContentHref(normalizedHref, {
      basePath: options.basePath,
      deadBlogSlugs: options.deadBlogSlugs ?? new Set(),
      deadProductSlugs: options.deadProductSlugs ?? new Set(),
    });

  return { href: normalizedHref, isDead };
}
