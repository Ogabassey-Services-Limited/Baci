import { asRoute } from '@/lib/routes';
import { generateSlug } from '@/lib/seo-utils';

export function getBlogCategorySlug(category: string): string {
  return generateSlug(category);
}

export function buildBlogCategoryHref(
  basePath: string,
  category: string
): string {
  const normalizedBasePath =
    basePath === '/' ? '' : basePath.replace(/\/+$/, '');

  return asRoute(
    `${normalizedBasePath}/blog/category/${getBlogCategorySlug(category)}`
  );
}

export function buildBlogCategorySchemaUrl(
  baseUrl: string,
  category: string
): string {
  const url = new URL(
    `blog/category/${getBlogCategorySlug(category)}`,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  );

  return url.toString();
}

export function findBlogCategoryLabelBySlug(
  categories: string[],
  categorySlug: string
): string | null {
  const normalizedSlug = categorySlug.toLowerCase();

  return (
    categories.find(
      (category) => getBlogCategorySlug(category) === normalizedSlug
    ) ?? null
  );
}
