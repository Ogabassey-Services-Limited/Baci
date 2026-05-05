import type { Product as StorefrontProduct } from '@/lib/products';
import { OGABASSEY_HOME_PRODUCT_FEED_LIMIT } from './config/products';
import type { Product as OgabasseyProduct } from './types';

type ConditionLabel = 'New' | 'Used' | 'Open Box' | 'New & Used';

const CONDITION_LABELS: Record<string, ConditionLabel> = {
  open_box: 'Open Box',
  new: 'New',
  used: 'Used',
};

const NGN_PRICE_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const mapCondition = (condition?: string): ConditionLabel => {
  return CONDITION_LABELS[condition || ''] || 'New';
};

const mapImage = (image: unknown): string => {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (
    typeof image === 'object' &&
    image !== null &&
    'url' in image &&
    typeof image.url === 'string'
  ) {
    return image.url;
  }

  return '';
};

export function mapStorefrontProductsToOgabasseyProducts(
  storefrontProducts: StorefrontProduct[]
): OgabasseyProduct[] {
  return storefrontProducts.map((product) => {
    const images: string[] = [];

    if (product.images) {
      for (const image of product.images) {
        const mappedImage = mapImage(image);
        if (mappedImage) {
          images.push(mappedImage);
        }
      }
    }

    const category =
      Array.isArray(product.categories) ? product.categories[0] : product.categories;
    const condition: ConditionLabel = product.has_condition_offers
      ? 'New & Used'
      : mapCondition(product.condition);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: NGN_PRICE_FORMATTER.format(product.price),
      rawPrice: product.price,
      image: product.image || images[0] || '',
      description: product.description,
      rating: product.rating ?? 4.5,
      category: category?.name || product.category || 'General',
      category_id: product.category_id,
      categories: category
        ? {
            id: category.id || product.category_id || `${product.id}-category`,
            name: category.name || product.category || 'General',
            slug: category.slug || product.category_slug,
            parent_id: category.parent_id,
          }
        : undefined,
      categorySlug: category?.slug || product.category_slug,
      condition,
      brand: product.brand,
      colors: product.colors,
      storage: product.storage_options?.[0],
      images,
      has_condition_offers: product.has_condition_offers,
    };
  });
}

export function createOgabasseyHomeProductFeed(
  storefrontProducts: StorefrontProduct[]
): OgabasseyProduct[] {
  return mapStorefrontProductsToOgabasseyProducts(
    storefrontProducts.slice(0, OGABASSEY_HOME_PRODUCT_FEED_LIMIT)
  );
}
