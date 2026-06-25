import { cacheLife, cacheTag } from 'next/cache';
import {
  getCachedFeatureSettings,
  getMerchantStrict,
  getPublicSupabaseClient,
} from '@/lib/cached-data';
import { filterPublicBlogCategories } from '@/lib/public-blog-content-quality';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import { buildStoreUrl } from '@/lib/store-url';
import {
  buildBlogCategorySchemaUrl,
  findBlogCategoryLabelBySlug,
} from './blog-category-routing';

export interface ResolvedBlogCategoryHub {
  canonicalUrl: string;
  categoryLabel: string;
}

export async function resolveBlogCategoryHub(
  slug: string,
  categorySlug: string
): Promise<ResolvedBlogCategoryHub | null> {
  'use cache';
  const lookupKey = slug.toLowerCase();
  cacheLife('merchant');
  cacheTag('blog-posts', `blog-category-hub-${lookupKey}`);

  const merchant = await getMerchantStrict(lookupKey);
  if (!merchant) {
    return null;
  }

  const features = await getCachedFeatureSettings(merchant.id);
  if (!features?.blog_enabled) {
    return null;
  }

  const supabase = getPublicSupabaseClient();
  let categoriesQuery = supabase
    .from('blog_posts')
    .select('category')
    .eq('merchant_id', merchant.id)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .not('title', 'is', null)
    .not('slug', 'is', null)
    .neq('title', '')
    .neq('slug', '')
    .not('category', 'is', null);

  categoriesQuery = applyPublicBlogSqlFilters(categoriesQuery, {
    includeCategoryFilters: true,
  });

  const { data: categories, error } = await categoriesQuery;
  if (error) {
    console.error('Failed to load blog categories for category hub', {
      merchantId: merchant.id,
      error,
    });
    throw new Error('Failed to load blog categories for category hub', {
      cause: error,
    });
  }

  const uniqueCategories = [
    ...new Set(categories?.map((entry) => entry.category).filter(Boolean)),
  ];
  const categoryLabel = findBlogCategoryLabelBySlug(
    filterPublicBlogCategories(uniqueCategories),
    categorySlug
  );
  if (!categoryLabel) {
    return null;
  }

  return {
    canonicalUrl: buildBlogCategorySchemaUrl(
      buildStoreUrl(merchant),
      categoryLabel
    ),
    categoryLabel,
  };
}
