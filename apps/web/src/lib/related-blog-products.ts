export const RELATED_BLOG_PRODUCTS_SELECT =
  'id, name, slug, categories:category_id!inner(slug)' as const;

interface RelatedBlogProductCategory {
  slug: string | null;
}

interface RelatedBlogProductRow {
  id: string;
  name: string;
  slug: string;
  categories?: RelatedBlogProductCategory | RelatedBlogProductCategory[] | null;
}

export interface RelatedBlogProduct {
  id: string;
  name: string;
  slug: string;
  category_slug: string | null;
}

export function normalizeRelatedBlogProducts(
  products: RelatedBlogProductRow[] | null | undefined
): RelatedBlogProduct[] {
  return (products ?? []).map(({ categories, ...product }) => {
    const category = Array.isArray(categories) ? categories[0] : categories;

    return {
      ...product,
      category_slug: category?.slug ?? null,
    };
  });
}
