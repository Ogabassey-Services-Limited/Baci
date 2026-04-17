import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';

type RawStorefrontProductRow = Record<string, unknown>;
type ImageInput = string | { url?: string; alt?: string; order?: number };

function mapProduct(product: RawStorefrontProductRow) {
  const normalized = normalizeProduct(product as RawDbProduct);
  const rawImages = (product.images as ImageInput[]) || [];
  const processedImages = rawImages.map((image, index) => {
    if (typeof image === 'string') {
      return { url: image, alt: (product.name as string) || '', order: index };
    }

    return {
      url: image.url || '',
      alt: image.alt || (product.name as string) || '',
      order: image.order ?? index,
    };
  });

  return {
    id: normalized.id,
    name: normalized.name,
    description: normalized.description,
    price: normalized.price,
    compare_at_price: normalized.compare_at_price,
    image: normalized.image,
    imageLarge: normalized.imageLarge,
    category: normalized.category,
    category_slug: normalized.category_slug,
    brand: normalized.brand,
    stock: normalized.stock,
    slug: normalized.slug,
    status: normalized.status || 'active',
    condition: normalized.condition,
    imageHint: product.image_hint,
    images: processedImages,
    has_variants: product.has_variants,
    sku: product.sku,
    manage_stock: product.manage_stock,
    low_stock_threshold: product.low_stock_threshold,
    specifications: product.specifications,
    has_condition_offers:
      typeof product.has_condition_offers === 'boolean'
        ? product.has_condition_offers
        : false,
    available_conditions: Array.isArray(product.available_conditions)
      ? product.available_conditions.filter(
          (condition): condition is string => typeof condition === 'string'
        )
      : [],
    variant_model: product.variant_model,
    offers: product.offers,
    colors:
      (typeof product.color === 'string' && product.color
        ? [product.color]
        : undefined) ||
      (product.color_images ? Object.keys(product.color_images as object) : []),
    variant_attributes: product.variant_attributes,
  };
}

function buildCategoryFilterSource(product: RawStorefrontProductRow) {
  const primaryCategory = Array.isArray(product.categories)
    ? product.categories[0]
    : product.categories;
  const relationCategories = Array.isArray(product.product_categories)
    ? product.product_categories.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || !('categories' in entry)) {
          return [];
        }

        const category = entry.categories;
        return category && typeof category === 'object'
          ? [
              {
                name:
                  typeof category.name === 'string' ? category.name : undefined,
                slug:
                  typeof category.slug === 'string' ? category.slug : undefined,
              },
            ]
          : [];
      })
    : [];
  const normalizedPrimaryCategory =
    primaryCategory && typeof primaryCategory === 'object'
      ? [
          {
            name:
              typeof primaryCategory.name === 'string'
                ? primaryCategory.name
                : undefined,
            slug:
              typeof primaryCategory.slug === 'string'
                ? primaryCategory.slug
                : undefined,
          },
        ]
      : [];

  return {
    category: typeof product.category === 'string' ? product.category : null,
    categories: [...normalizedPrimaryCategory, ...relationCategories],
  };
}

function escapeLikePattern(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

function getConditionPrefilterClauses(condition: string) {
  const normalized = normalizeCanonicalProductCondition(condition);

  if (!normalized) {
    return [];
  }

  const rawConditions =
    normalized === 'open_box'
      ? ['open_box', 'refurbished']
      : normalized === 'used'
        ? ['used', 'uk_used']
        : ['new'];
  const clauses = new Set<string>();

  for (const rawCondition of rawConditions) {
    clauses.add(`condition.eq.${rawCondition}`);
    clauses.add(`available_conditions.cs.{${rawCondition}}`);
  }

  if (normalized === 'new' || normalized === 'used') {
    clauses.add('has_condition_offers.eq.true');
  }

  return Array.from(clauses);
}

const STOREFRONT_PRODUCTS_SELECT = `
  id,
  created_at,
  name,
  description,
  price,
  compare_at_price,
  images,
  image_hint,
  category,
  category_id,
  brand,
  stock,
  stock_quantity,
  slug,
  status,
  condition,
  has_variants,
  sku,
  manage_stock,
  low_stock_threshold,
  specifications,
  has_condition_offers,
  available_conditions,
  variant_model,
  offers,
  color,
  color_images,
  variant_attributes,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;

export const storefrontProductsRouteData = {
  buildCategoryFilterSource,
  escapeLikePattern,
  getConditionPrefilterClauses,
  mapProduct,
  STOREFRONT_PRODUCTS_SELECT,
} as const;
