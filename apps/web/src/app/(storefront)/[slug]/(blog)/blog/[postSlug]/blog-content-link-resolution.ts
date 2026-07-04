import { getCachedContentLinkRewrites } from '@/lib/cached-content-link-rewrites';
import { getCachedDeadContentLinkSlugs } from '@/lib/cached-dead-content-links';
import {
  collectStorefrontContentLinkTargets,
  type DeadStorefrontContentLinkSlugs,
  type StorefrontContentLinkRewrites,
} from '@/lib/storefront-content-link-targets';

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
  merchantSlug: string
): Promise<ContentLinkResolution> {
  if (!merchantId) {
    return NO_CONTENT_LINK_RESOLUTION;
  }

  const contentStr =
    typeof content === 'string'
      ? content
      : content && typeof content === 'object'
        ? JSON.stringify(content)
        : '';
  const { blogSlugs, productSlugs } = collectStorefrontContentLinkTargets(
    contentStr,
    merchantSlug
  );

  if (blogSlugs.length === 0 && productSlugs.length === 0) {
    return NO_CONTENT_LINK_RESOLUTION;
  }

  // Fail open independently: on a transient error keep all links (no
  // unwrapping) and/or leave hrefs untouched (no rewriting).
  const [dead, rewrites] = await Promise.all([
    getCachedDeadContentLinkSlugs(merchantId, blogSlugs, productSlugs).catch(
      (error) => {
        console.error('Error resolving dead content links', {
          error,
          merchantId,
        });
        return NO_DEAD_CONTENT_LINKS;
      }
    ),
    getCachedContentLinkRewrites(merchantId, blogSlugs, productSlugs).catch(
      (error) => {
        console.error('Error resolving content link rewrites', {
          error,
          merchantId,
        });
        return NO_CONTENT_LINK_REWRITES;
      }
    ),
  ]);

  return {
    deadContentLinks: {
      blog: dead.blog.filter((slug) => !rewrites.blogSlugs[slug]),
      products: dead.products.filter((slug) => !rewrites.productPaths[slug]),
    },
    rewrites,
  };
}
