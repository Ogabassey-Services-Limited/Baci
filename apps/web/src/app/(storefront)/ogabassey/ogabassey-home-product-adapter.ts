import type { getCachedStorefrontHomeProducts } from '@/lib/cached-data';
import type { Product, ProductCondition, ProductImage } from '@/lib/products';

type StorefrontHomeProduct = Awaited<
  ReturnType<typeof getCachedStorefrontHomeProducts>
>[number];

const PRODUCT_CONDITION_VALUES = [
  'new',
  'used',
  'open_box',
  'refurbished',
] as const satisfies readonly ProductCondition[];

const PRODUCT_CONDITIONS = new Set<string>(PRODUCT_CONDITION_VALUES);

function isProductCondition(value: unknown): value is ProductCondition {
  return typeof value === 'string' && PRODUCT_CONDITIONS.has(value);
}

function getNullableNumber(
  value: number | null | undefined
): number | undefined {
  return value ?? undefined;
}

function mapHomeProductImage(
  image: unknown,
  fallbackAlt: string,
  fallbackOrder: number
): ProductImage | null {
  if (typeof image === 'string') {
    const url = image.trim();
    return url ? { url, alt: fallbackAlt, order: fallbackOrder } : null;
  }

  if (!image || typeof image !== 'object' || !('url' in image)) {
    return null;
  }

  const candidate = image as Record<string, unknown>;
  if (typeof candidate.url !== 'string' || !candidate.url.trim()) {
    return null;
  }

  return {
    url: candidate.url.trim(),
    alt: typeof candidate.alt === 'string' ? candidate.alt : fallbackAlt,
    order:
      typeof candidate.order === 'number' ? candidate.order : fallbackOrder,
  };
}

function mapHomeProductImages(product: StorefrontHomeProduct): ProductImage[] {
  if (!Array.isArray(product.images)) {
    return [];
  }

  return product.images.flatMap((image, index) => {
    const mappedImage = mapHomeProductImage(image, product.name, index);
    return mappedImage ? [mappedImage] : [];
  });
}

function mapHomeProductCategory(
  product: StorefrontHomeProduct
): Product['categories'] {
  const categoryRelation = product.product_categories?.[0]?.categories;
  const category = Array.isArray(categoryRelation)
    ? categoryRelation[0]
    : categoryRelation;

  if (!category || typeof category !== 'object') {
    return null;
  }

  const candidate = category as Record<string, unknown>;
  return {
    id: typeof candidate.id === 'string' ? candidate.id : undefined,
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    slug: typeof candidate.slug === 'string' ? candidate.slug : undefined,
    parent_id:
      typeof candidate.parent_id === 'string' ? candidate.parent_id : undefined,
  };
}

export function mapHomeProductsToTemplateProducts(
  products: StorefrontHomeProduct[]
): Product[] {
  return products.map((product) => {
    const images = mapHomeProductImages(product);
    const primaryImage = images[0]?.url || '';
    const category = mapHomeProductCategory(product);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug ?? undefined,
      description: product.description || '',
      status: 'active',
      price: product.price,
      compare_at_price: getNullableNumber(product.compare_at_price),
      manage_stock: product.manage_stock,
      stock: product.stock_quantity ?? product.stock ?? 0,
      image: primaryImage,
      imageLarge: primaryImage,
      imageHint: product.brand || product.name,
      brand: product.brand || '',
      // The homepage query intentionally omits GTIN/MPN to keep the first
      // render payload small; detail/catalog queries still load identifiers.
      gtin: '',
      mpn: '',
      category: product.category ?? undefined,
      category_slug: category?.slug,
      categories: category,
      condition: isProductCondition(product.condition)
        ? product.condition
        : undefined,
      images,
      low_stock_threshold: getNullableNumber(product.low_stock_threshold),
    };
  });
}
