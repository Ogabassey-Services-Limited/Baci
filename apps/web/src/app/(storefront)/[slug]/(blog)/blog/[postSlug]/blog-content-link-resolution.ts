import { getCachedContentLinkRewrites } from '@/lib/cached-content-link-rewrites';
import { getCachedDeadContentLinkSlugs } from '@/lib/cached-dead-content-links';
import type { StorefrontContentLinkRewrites } from '@/lib/storefront-content-link-rewriting';
import {
  collectStorefrontContentLinkTargets,
  type DeadStorefrontContentLinkSlugs,
} from '@/lib/storefront-content-link-targets';
import { stringifyBlogContent } from '@/lib/stringify-blog-content';

const NO_DEAD_CONTENT_LINKS: DeadStorefrontContentLinkSlugs = {
  blog: [],
  products: [],
};

const NO_CONTENT_LINK_REWRITES: StorefrontContentLinkRewrites = {
  blogSlugs: {},
  productPaths: {},
};

export interface ContentLinkResolution {
  deadContentLinks: DeadStorefrontContentLinkSlugs;
  rewrites: StorefrontContentLinkRewrites;
}

const NO_CONTENT_LINK_RESOLUTION: ContentLinkResolution = {
  deadContentLinks: NO_DEAD_CONTENT_LINKS,
  rewrites: NO_CONTENT_LINK_REWRITES,
};

/**
 * Collects internal blog/product link targets from post content and resolves
 * them into two disjoint outcomes: canonical rewrites for redirectable targets
 * (renamed posts, consolidated/re-categorized products) and dead slugs whose
 * anchors should be unwrapped. A slug with a rewrite is never reported dead —
 * its target resolves via a permanent redirect, so the link must be fixed in
 * place, not removed.
 */
export async function resolveContentLinks(
  content: unknown,
  merchantId: string | undefined,
  merchantSlug: string,
  baseUrl?: string
): Promise<ContentLinkResolution> {
  if (!merchantId) {
    return NO_CONTENT_LINK_RESOLUTION;
  }

  const contentStr = stringifyBlogContent(content);
  // baseUrl lets collection recognize absolute same-site URLs on custom
  // domains whose hostname does not contain the merchant slug.
  const { blogSlugs, productSlugs } = collectStorefrontContentLinkTargets(
    contentStr,
    merchantSlug,
    baseUrl
  );

  if (blogSlugs.length === 0 && productSlugs.length === 0) {
    return NO_CONTENT_LINK_RESOLUTION;
  }

  // Fail open independently: on a transient error keep all links (no
  // unwrapping) and/or leave hrefs untouched (no rewriting).
  const [dead, rewritesOutcome] = await Promise.all([
    getCachedDeadContentLinkSlugs(merchantId, blogSlugs, productSlugs).catch(
      (error) => {
        console.error('Error resolving dead content links', {
          error,
          merchantId,
        });
        return NO_DEAD_CONTENT_LINKS;
      }
    ),
    getCachedContentLinkRewrites(merchantId, blogSlugs, productSlugs).then(
      (rewrites) => ({ rewrites, failed: false }),
      (error) => {
        console.error('Error resolving content link rewrites', {
          error,
          merchantId,
        });
        return { rewrites: NO_CONTENT_LINK_REWRITES, failed: true };
      }
    ),
  ]);

  // The dead sets are only trustworthy when the rewrites lookup succeeded:
  // without it a redirectable slug (archived variant, renamed post) cannot be
  // excluded and would be unwrapped even though its link works. Suppress
  // unwrapping entirely for that request instead — a dead link surviving one
  // render beats destroying a working link.
  if (rewritesOutcome.failed) {
    return NO_CONTENT_LINK_RESOLUTION;
  }

  const { rewrites } = rewritesOutcome;
  return {
    deadContentLinks: {
      // Object.hasOwn: a dead slug named like an Object.prototype member
      // (constructor, toString, …) must not read as "has a rewrite".
      blog: dead.blog.filter(
        (slug) => !Object.hasOwn(rewrites.blogSlugs, slug)
      ),
      products: dead.products.filter(
        (slug) => !Object.hasOwn(rewrites.productPaths, slug)
      ),
    },
    rewrites,
  };
}
