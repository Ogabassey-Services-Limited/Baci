import {
  BLOCKED_PUBLIC_BLOG_CATEGORY_VALUES,
  BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS,
  BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES,
} from '@/lib/public-blog-content-quality';

interface PublicBlogContentFilterQuery {
  not(
    column: string,
    operator: 'ilike',
    value: string
  ): PublicBlogContentFilterQuery;
}

interface PublicBlogSqlFilterOptions {
  includeCategoryFilters?: boolean;
}

export function applyPublicBlogSqlFilters<
  TQuery extends PublicBlogContentFilterQuery,
>(query: TQuery, options: PublicBlogSqlFilterOptions = {}): TQuery {
  let filteredQuery: PublicBlogContentFilterQuery = query;

  for (const blockedPrefix of BLOCKED_PUBLIC_BLOG_POST_TITLE_PREFIXES) {
    filteredQuery = filteredQuery.not('title', 'ilike', `${blockedPrefix}%`);
  }

  for (const blockedSlugPart of BLOCKED_PUBLIC_BLOG_POST_SLUG_PARTS) {
    filteredQuery = filteredQuery.not('slug', 'ilike', `%${blockedSlugPart}%`);
  }

  if (options.includeCategoryFilters) {
    for (const blockedCategory of BLOCKED_PUBLIC_BLOG_CATEGORY_VALUES) {
      filteredQuery = filteredQuery.not('category', 'ilike', blockedCategory);
    }
  }

  return filteredQuery as TQuery;
}
