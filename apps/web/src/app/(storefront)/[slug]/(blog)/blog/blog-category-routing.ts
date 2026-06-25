import { asRoute } from '@/lib/routes';
import { generateSlug } from '@/lib/seo-utils';

export function getBlogCategorySlug(category: string): string {
  return generateSlug(category);
}

function getDistinctCategoryLabels(categories: string[]): string[] {
  return [
    ...new Set(categories.map((category) => category.trim()).filter(Boolean)),
  ];
}

export function getCollidingBlogCategorySlugs(
  categories: string[]
): Set<string> {
  const labelsBySlug = new Map<string, Set<string>>();

  for (const category of getDistinctCategoryLabels(categories)) {
    const slug = getBlogCategorySlug(category);
    if (!slug) {
      continue;
    }
    const labels = labelsBySlug.get(slug) ?? new Set<string>();
    labels.add(category);
    labelsBySlug.set(slug, labels);
  }

  return new Set(
    Array.from(labelsBySlug.entries())
      .filter(([, labels]) => labels.size > 1)
      .map(([slug]) => slug)
  );
}

export function hasBlogCategorySlugCollision(
  categories: string[],
  categorySlug: string
): boolean {
  return getCollidingBlogCategorySlugs(categories).has(
    categorySlug.toLowerCase()
  );
}

export function buildBlogCategoryHref(
  basePath: string,
  category: string,
  categories: string[] = []
): string {
  const normalizedBasePath =
    basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  const categorySlug = getBlogCategorySlug(category);

  if (hasBlogCategorySlugCollision(categories, categorySlug)) {
    const query = new URLSearchParams({ category: category.trim() });

    return asRoute(`${normalizedBasePath}/blog?${query.toString()}`);
  }

  return asRoute(`${normalizedBasePath}/blog/category/${categorySlug}`);
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
  if (hasBlogCategorySlugCollision(categories, normalizedSlug)) {
    return null;
  }

  return (
    getDistinctCategoryLabels(categories).find(
      (category) => getBlogCategorySlug(category) === normalizedSlug
    ) ?? null
  );
}
