import { classifyStorefrontContentPath } from '@/lib/storefront-content-link-targets';

export interface StorefrontContentLinkRewrites {
  /** Renamed blog posts: source slug -> live target slug. */
  blogSlugs: Record<string, string>;
  /** Product slugs -> canonical `/<category>/<slug>` path. */
  productPaths: Record<string, string>;
}

export interface RewriteStorefrontContentHrefOptions {
  basePath?: string;
  rewrites: StorefrontContentLinkRewrites;
}

/**
 * Returns the canonical replacement for an internal content href whose target
 * resolves through a permanent redirect (renamed blog post, consolidated or
 * re-categorized product), or null when the href is already canonical or not
 * an internal blog/product link. Query strings and hashes are preserved, as is
 * a leading basePath prefix.
 */
export function rewriteStorefrontContentHref(
  href: string,
  options: RewriteStorefrontContentHrefOptions
): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) {
    return null;
  }

  const { blogSlugs, productPaths } = options.rewrites;
  if (
    Object.keys(blogSlugs).length === 0 &&
    Object.keys(productPaths).length === 0
  ) {
    return null;
  }

  const suffixStart = href.search(/[?#]/);
  const suffix = suffixStart === -1 ? '' : href.slice(suffixStart);
  let pathname = suffixStart === -1 ? href : href.slice(0, suffixStart);

  let prefix = '';
  const basePath = options.basePath?.replace(/\/+$/, '');
  if (basePath && basePath !== '/' && pathname.startsWith(`${basePath}/`)) {
    prefix = basePath;
    pathname = pathname.slice(basePath.length);
  }

  const classified = classifyStorefrontContentPath(pathname);
  if (!classified) {
    return null;
  }

  // Object.hasOwn: slugs shadowing Object.prototype members must not
  // resolve inherited functions into hrefs.
  const canonicalPath =
    classified.kind === 'blog'
      ? Object.hasOwn(blogSlugs, classified.slug)
        ? `/blog/${blogSlugs[classified.slug]}`
        : null
      : Object.hasOwn(productPaths, classified.slug)
        ? productPaths[classified.slug]
        : null;

  if (!canonicalPath) {
    return null;
  }

  const rewritten = `${prefix}${canonicalPath}${suffix}`;
  return rewritten === href ? null : rewritten;
}
