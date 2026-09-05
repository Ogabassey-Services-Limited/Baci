export const RELATED_BLOG_PRODUCTS_SELECT =
  'id, name, slug, price, compare_at_price, categories:category_id!inner(slug)' as const;

export const RELATED_BLOG_PRODUCT_LINKS_SELECT =
  'relationship, product:products!blog_post_products_product_id_fkey(id, name, slug, price, compare_at_price, status, categories:category_id(slug))' as const;

interface RelatedBlogProductCategory {
  slug: string | null;
}

interface RelatedBlogProductRow {
  compare_at_price?: number | string | null;
  id: string;
  name: string;
  price?: number | string | null;
  slug: string;
  status?: string | null;
  categories?: RelatedBlogProductCategory | RelatedBlogProductCategory[] | null;
}

interface RelatedBlogProductLinkRow {
  product?: RelatedBlogProductRow | RelatedBlogProductRow[] | null;
}

export interface RelatedBlogProduct {
  compare_at_price?: number;
  id: string;
  name: string;
  price?: number;
  slug: string;
  category_slug?: string | null;
}

function normalizePrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null;
}

export function normalizeRelatedBlogProducts(
  products: RelatedBlogProductRow[] | null | undefined
): RelatedBlogProduct[] {
  return (products ?? []).map(
    ({ categories, compare_at_price, price, status: _status, ...product }) => {
      const category = Array.isArray(categories) ? categories[0] : categories;
      const normalizedPrice = normalizePrice(price);
      const normalizedCompareAtPrice = normalizePrice(compare_at_price);

      return {
        ...product,
        category_slug: category?.slug ?? null,
        ...(normalizedPrice !== null ? { price: normalizedPrice } : {}),
        ...(normalizedCompareAtPrice !== null
          ? { compare_at_price: normalizedCompareAtPrice }
          : {}),
      };
    }
  );
}

export function normalizeRelatedBlogProductLinks(
  links: RelatedBlogProductLinkRow[] | null | undefined
): RelatedBlogProduct[] {
  const products = (links ?? []).flatMap((link) => {
    const product = Array.isArray(link.product)
      ? link.product[0]
      : link.product;

    if (product?.status !== 'active') {
      return [];
    }

    return [product];
  });

  return normalizeRelatedBlogProducts(products);
}
