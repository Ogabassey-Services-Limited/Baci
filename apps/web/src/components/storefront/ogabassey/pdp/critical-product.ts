type CategoryShape =
  | { id?: string | null; name?: string | null; slug?: string | null }
  | null
  | undefined;

type ProductImage = string | { alt?: string | null; url?: string | null };

export interface OgabasseyPdpCriticalProductInput {
  brand?: string | null;
  category?: string | null;
  category_slug?: string | null;
  categories?: CategoryShape | CategoryShape[];
  condition?: string | null;
  id: string;
  image?: string | null;
  imageLarge?: string | null;
  images?: ProductImage[] | null;
  name: string;
  price?: number | string | null;
  product_categories?: Array<{
    categories?: CategoryShape | CategoryShape[];
  }>;
  schema_markup?: unknown;
  slug?: string | null;
  stock_quantity?: number | null;
}

export interface OgabasseyPdpCriticalProduct {
  brand: string;
  categoryName: string;
  categorySlug: string;
  condition: string;
  id: string;
  image: string;
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  slug: string;
  stockQuantity: number | null;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function firstCategory(value: CategoryShape | CategoryShape[]) {
  return Array.isArray(value) ? value[0] : value;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getAggregateRating(schemaMarkup: unknown) {
  if (!schemaMarkup || typeof schemaMarkup !== 'object') {
    return { rating: 0, reviewCount: 0 };
  }

  const schema = schemaMarkup as {
    aggregateRating?: {
      ratingCount?: unknown;
      ratingValue?: unknown;
      reviewCount?: unknown;
    };
  };

  return {
    rating: parseNumber(schema.aggregateRating?.ratingValue),
    reviewCount: parseNumber(
      schema.aggregateRating?.reviewCount ??
        schema.aggregateRating?.ratingCount
    ),
  };
}

export function getOgabasseyPdpPrimaryImage(
  product: Pick<
    OgabasseyPdpCriticalProductInput,
    'image' | 'imageLarge' | 'images'
  >
): string {
  const firstImage = Array.isArray(product.images) ? product.images[0] : null;
  const mappedFirstImage =
    typeof firstImage === 'string' ? firstImage : firstImage?.url || null;

  return (
    product.imageLarge ||
    product.image ||
    mappedFirstImage ||
    '/placeholder.png'
  );
}

export function buildOgabasseyPdpCriticalProduct(
  product: OgabasseyPdpCriticalProductInput
): OgabasseyPdpCriticalProduct {
  const directCategory = firstCategory(product.categories);
  const fallbackCategory = firstCategory(
    product.product_categories?.[0]?.categories
  );
  const category = directCategory || fallbackCategory;
  const categoryName = category?.name || product.category || 'Electronics';
  const aggregateRating = getAggregateRating(product.schema_markup);

  return {
    brand: product.brand || 'OgaBassey',
    categoryName,
    categorySlug:
      category?.slug || product.category_slug || slugify(categoryName),
    condition: product.condition || 'new',
    id: product.id,
    image: getOgabasseyPdpPrimaryImage(product),
    name: product.name,
    price: parseNumber(product.price),
    rating: aggregateRating.rating,
    reviewCount: aggregateRating.reviewCount,
    slug: product.slug || product.id,
    stockQuantity:
      typeof product.stock_quantity === 'number'
        ? product.stock_quantity
        : null,
  };
}
