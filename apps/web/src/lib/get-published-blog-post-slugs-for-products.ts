import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeStorefrontCategoryValue } from '@/lib/normalize-storefront-category-value';
import { isValidUuid } from '@/lib/sanitize-core';

const MAX_CATEGORY_FALLBACK_BLOG_POSTS = 256;

interface LinkedBlogPostRow {
  blog_posts?:
    | {
        published_at?: string | null;
        slug?: string | null;
        status?: string | null;
      }
    | Array<{
        published_at?: string | null;
        slug?: string | null;
        status?: string | null;
      }>
    | null;
}

interface BlogPostFields {
  category?: string | null;
  published_at?: string | null;
  slug?: string | null;
  status?: string | null;
}

interface CategoryBlogPostRow extends BlogPostFields {}

function getBlogPostRow(value: LinkedBlogPostRow['blog_posts']): {
  published_at?: string | null;
  slug?: string | null;
  status?: string | null;
} | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function getPublishedBlogPostSlug(post: BlogPostFields | null | undefined) {
  if (
    post?.status !== 'published' ||
    typeof post.published_at !== 'string' ||
    post.published_at.length === 0 ||
    typeof post.slug !== 'string'
  ) {
    return null;
  }

  const slug = post.slug.trim().toLowerCase();
  return slug.length > 0 ? slug : null;
}

function buildCategoryCandidates(categorySlugs: readonly string[]) {
  const candidates = new Set<string>();

  for (const value of categorySlugs) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const spaced = trimmed.replace(/[-_]+/gu, ' ');
    const titleCased = spaced.replace(
      /(^|\s)([a-z])/giu,
      (_match, prefix: string, character: string) =>
        `${prefix}${character.toUpperCase()}`
    );

    for (const candidate of [
      trimmed,
      trimmed.toLowerCase(),
      spaced,
      titleCased,
    ]) {
      if (candidate.length > 0) candidates.add(candidate);
    }
  }

  return Array.from(candidates);
}

function buildCanonicalCategorySlugs(categorySlugs: readonly string[]) {
  return Array.from(
    new Set(
      categorySlugs
        .map((categorySlug) => normalizeStorefrontCategoryValue(categorySlug))
        .filter((categorySlug): categorySlug is string => Boolean(categorySlug))
    )
  );
}

function buildCanonicalCategoryFilter(categorySlugs: readonly string[]) {
  return buildCanonicalCategorySlugs(categorySlugs)
    .map(
      (categorySlug) => `category.ilike.*${categorySlug.split('-').join('*')}*`
    )
    .join(',');
}

function getCanonicalCategoryPostRows(
  rows: readonly CategoryBlogPostRow[],
  categorySlugs: readonly string[]
) {
  const canonicalCategories = new Set(
    buildCanonicalCategorySlugs(categorySlugs)
  );
  return rows.filter((post) => {
    const category = normalizeStorefrontCategoryValue(post.category);
    return category !== null && canonicalCategories.has(category);
  });
}

/**
 * Find published storefront blog posts whose related-product rail can be
 * affected by the changed products. Explicit product relationships are joined
 * with a bounded category fallback for legacy posts that derive their rail from
 * the product category instead of `blog_post_products`. Results are deduplicated
 * before callers evict their edge-cached article URLs. Any read failure is
 * fail-open because cache expiry remains safe and a product mutation must not
 * fail on best-effort CDN invalidation.
 */
export async function getPublishedBlogPostSlugsForProducts(
  supabase: SupabaseClient,
  merchantId: string,
  productIds: readonly string[],
  categorySlugs: readonly string[] = []
): Promise<string[]> {
  const normalizedMerchantId = merchantId.trim();
  const normalizedProductIds = Array.from(
    new Set(
      productIds
        .map((productId) => productId.trim())
        .filter((productId) => productId.length > 0 && isValidUuid(productId))
    )
  );
  const categoryCandidates = buildCategoryCandidates(categorySlugs);
  const canonicalCategoryFilter = buildCanonicalCategoryFilter(categorySlugs);

  if (
    !normalizedMerchantId ||
    (normalizedProductIds.length === 0 && categoryCandidates.length === 0)
  ) {
    return [];
  }

  const slugs = new Set<string>();

  if (normalizedProductIds.length > 0) {
    try {
      const { data, error } = await supabase
        .from('blog_post_products')
        .select('blog_posts!inner(slug, status, published_at)')
        .eq('merchant_id', normalizedMerchantId)
        .in('product_id', normalizedProductIds);

      if (error) {
        console.error(
          'Failed to resolve published blog posts for product purge (continuing without article purge):',
          { merchantId: normalizedMerchantId, error }
        );
      } else {
        for (const row of (data as unknown as
          | LinkedBlogPostRow[]
          | null
          | undefined) ?? []) {
          const slug = getPublishedBlogPostSlug(getBlogPostRow(row.blog_posts));
          if (slug) slugs.add(slug);
        }
      }
    } catch (error) {
      console.error(
        'Failed to resolve published blog posts for product purge (continuing without article purge):',
        { merchantId: normalizedMerchantId, error }
      );
    }
  }

  if (categoryCandidates.length > 0) {
    try {
      const { data: exactData, error: exactError } = await supabase
        .from('blog_posts')
        .select('slug, status, published_at, category')
        .eq('merchant_id', normalizedMerchantId)
        .eq('status', 'published')
        .in('category', categoryCandidates)
        .order('published_at', { ascending: false })
        .limit(MAX_CATEGORY_FALLBACK_BLOG_POSTS);

      if (exactError) {
        console.error(
          'Failed to resolve category-fallback blog posts for product purge (continuing without category article purge):',
          { merchantId: normalizedMerchantId, error: exactError }
        );
      } else {
        for (const post of (exactData as unknown as
          | CategoryBlogPostRow[]
          | null
          | undefined) ?? []) {
          const slug = getPublishedBlogPostSlug(post);
          if (slug) slugs.add(slug);
        }
      }

      if (canonicalCategoryFilter.length > 0) {
        const { data: canonicalData, error: canonicalError } = await supabase
          .from('blog_posts')
          .select('slug, status, published_at, category')
          .eq('merchant_id', normalizedMerchantId)
          .eq('status', 'published')
          .or(canonicalCategoryFilter)
          .order('published_at', { ascending: false })
          .limit(MAX_CATEGORY_FALLBACK_BLOG_POSTS);

        if (canonicalError) {
          console.error(
            'Failed to resolve canonical category-fallback blog posts for product purge (continuing without canonical category article purge):',
            { merchantId: normalizedMerchantId, error: canonicalError }
          );
        } else {
          const canonicalRows = getCanonicalCategoryPostRows(
            (canonicalData as unknown as
              | CategoryBlogPostRow[]
              | null
              | undefined) ?? [],
            categorySlugs
          );
          for (const post of canonicalRows) {
            const slug = getPublishedBlogPostSlug(post);
            if (slug) slugs.add(slug);
          }
        }
      }
    } catch (error) {
      console.error(
        'Failed to resolve category-fallback blog posts for product purge (continuing without category article purge):',
        { merchantId: normalizedMerchantId, error }
      );
    }
  }

  return Array.from(slugs);
}
