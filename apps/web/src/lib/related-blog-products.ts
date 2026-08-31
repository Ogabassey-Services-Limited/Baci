export const RELATED_BLOG_PRODUCTS_SELECT =
  'id, name, slug, price, compare_at_price, stock, stock_quantity, manage_stock, categories:category_id!inner(slug)' as const;

export const RELATED_BLOG_PRODUCT_LINKS_SELECT =
  'relationship, product:products!blog_post_products_product_id_fkey(id, name, slug, status, price, compare_at_price, stock, stock_quantity, manage_stock, categories:category_id(slug))' as const;

interface RelatedBlogProductCategory {
  slug: string | null;
}

interface RelatedBlogProductRow {
  compare_at_price?: number | null;
  id: string;
  name: string;
  manage_stock?: boolean | null;
  price?: number | null;
  slug: string;
  stock?: number | null;
  stock_quantity?: number | null;
  status?: string | null;
  categories?: RelatedBlogProductCategory | RelatedBlogProductCategory[] | null;
}

interface RelatedBlogProductLinkRow {
  product?: RelatedBlogProductRow | RelatedBlogProductRow[] | null;
}

export interface RelatedBlogProduct {
  compare_at_price?: number | null;
  id: string;
  name: string;
  manage_stock?: boolean | null;
  price?: number | null;
  slug: string;
  stock?: number | null;
  stock_quantity?: number | null;
  category_slug: string | null;
}

export function normalizeRelatedBlogProducts(
  products: RelatedBlogProductRow[] | null | undefined
): RelatedBlogProduct[] {
  return (products ?? []).map(({ categories, status: _status, ...product }) => {
    const category = Array.isArray(categories) ? categories[0] : categories;

    return {
      ...product,
      category_slug: category?.slug ?? null,
    };
  });
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
