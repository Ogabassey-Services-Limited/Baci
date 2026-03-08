import type { Product as CartProduct } from '@/lib/products';
import type {
  Product,
  ProductSpecItem,
  ProductSpecSection,
} from '../../types';

export type ConditionType = 'new' | 'used' | 'open_box' | 'refurbished';

interface ProductWithDynamicFields extends Product {
  color_images?: Record<string, string[]>;
  variant_attributes?: Record<string, string[]>;
  specifications?: ProductSpecSection[];
}

export interface ProductColorOption {
  name: string;
  value: string;
}

export interface NormalizedProductDetails extends ProductWithDynamicFields {
  colorImages: Record<string, string[]>;
  colors: ProductColorOption[];
  condition: ConditionType;
  description: string;
  detailedSpecs: ProductSpecSection[];
  images: string[];
  platforms: string[];
  rating: number;
  reviewCount: number;
  specs: ProductSpecItem[];
  storage: string[];
}

export interface ProductDetailsCurrentOffer {
  id: Product['id'];
  price: string;
  rawPrice: number;
  stock: number;
}

function getColorHex(name: string) {
  const lower = name.toLowerCase();

  if (
    lower.includes('black') ||
    lower.includes('obsidian') ||
    lower.includes('midnight') ||
    lower.includes('graphite') ||
    lower.includes('space grey')
  ) {
    return '#1a1a1a';
  }

  if (
    lower.includes('white') ||
    lower.includes('starlight') ||
    lower.includes('porcelain')
  ) {
    return '#f2f2f2';
  }

  if (
    lower.includes('blue') ||
    lower.includes('bay') ||
    lower.includes('pacific')
  ) {
    return '#2f3d4d';
  }

  if (
    lower.includes('natural') ||
    lower.includes('grey') ||
    lower.includes('gray')
  ) {
    return '#808080';
  }

  if (lower.includes('silver')) {
    return '#e0e0e0';
  }

  if (lower.includes('gold')) {
    return '#F5E0C3';
  }

  return '#cccccc';
}

function normalizeRelatedProductCondition(
  condition?: Product['condition']
): CartProduct['condition'] {
  if (!condition) {
    return undefined;
  }

  const normalized = condition.toLowerCase().replace(/\s+/g, '_');

  return normalized === 'new' ||
    normalized === 'used' ||
    normalized === 'open_box' ||
    normalized === 'refurbished'
    ? normalized
    : undefined;
}

function parseRelatedProductPrice(product: Product): number {
  if (
    typeof product.rawPrice === 'number' &&
    Number.isFinite(product.rawPrice)
  ) {
    return product.rawPrice;
  }

  const parsedPrice = Number.parseFloat(
    String(product.price).replace(/[^0-9.]/g, '')
  );

  return Number.isFinite(parsedPrice) ? parsedPrice : 0;
}

export function toRelatedProductsProduct(product: Product): CartProduct {
  const primaryImage = product.images?.[0] || product.image || '/placeholder.svg';

  return {
    id: String(product.id),
    merchant_id: product.merchantId,
    name: product.name,
    description: product.description || '',
    status: 'active',
    price: parseRelatedProductPrice(product),
    manage_stock: Boolean(product.manage_stock),
    stock: product.stock ?? 0,
    image: primaryImage,
    imageLarge: primaryImage,
    imageHint: product.brand || product.name,
    brand: product.brand || '',
    gtin: '',
    mpn: '',
    slug: product.slug,
    category: product.category,
    category_slug: product.categorySlug,
    categories: product.categories
      ? {
          id: product.categories.id,
          name: product.categories.name,
          slug: product.categories.slug,
          parent_id: product.categories.parent_id ?? undefined,
        }
      : null,
    condition: normalizeRelatedProductCondition(product.condition),
  };
}

export function normalizeProductDetails(
  serverProduct: Product
): NormalizedProductDetails {
  const product = serverProduct as ProductWithDynamicFields;
  const colorImages = product.color_images || {};

  let colors: ProductColorOption[] = [];
  if (Object.keys(colorImages).length > 0) {
    colors = Object.keys(colorImages).map((colorName) => ({
      name: colorName,
      value: getColorHex(colorName),
    }));
  } else if (product.colors && product.colors.length > 0) {
    colors = product.colors.map((color) => {
      const normalizedColor =
        typeof color === 'string'
          ? { name: color, value: getColorHex(color) }
          : color;

      return {
        name: normalizedColor.name,
        value: normalizedColor.value,
      };
    });
  }

  const storage = product.storage
    ? Array.isArray(product.storage)
      ? product.storage
      : [product.storage]
    : [];

  const images =
    product.images && product.images.length > 0
      ? [...product.images]
      : product.image
        ? [product.image]
        : [];

  for (const colorImageGroup of Object.values(colorImages)) {
    for (const image of colorImageGroup) {
      if (!images.includes(image)) {
        images.push(image);
      }
    }
  }

  if (images.length === 0) {
    images.push('/placeholder.svg');
  }

  const platforms =
    product.variant_attributes?.Platform?.length
      ? product.variant_attributes.Platform
      : product.variants
        ? Array.from(
            new Set(
              product.variants
                .map((variant) => variant.attributes?.platform)
                .filter(Boolean)
            )
          ) as string[]
        : [];

  const detailedSpecs =
    Array.isArray(product.specifications) && product.specifications.length > 0
      ? product.specifications
      : Array.isArray(product.detailedSpecs) && product.detailedSpecs.length > 0
        ? product.detailedSpecs
        : [
            {
              category: 'General',
              items: [
                { label: 'Brand', value: product.brand || 'Generic' },
                { label: 'Condition', value: product.condition || 'New' },
                {
                  label: 'Category',
                  value:
                    product.categories?.name || product.category || 'General',
                },
              ],
            },
          ];

  const specs =
    product.specs && product.specs.length > 0
      ? product.specs
      : [
          { label: 'Brand', value: product.brand || 'Generic' },
          { label: 'Condition', value: product.condition || 'New' },
        ];

  return {
    ...product,
    colorImages,
    colors,
    condition: (product.condition || 'new') as ConditionType,
    description: product.description || 'No description available.',
    detailedSpecs,
    images,
    platforms,
    rating: product.rating || 0,
    reviewCount: product.reviews || 0,
    specs,
    storage,
  };
}

export function buildCartItemId(productId: Product['id'], options?: {
  color?: string;
  condition?: string;
  storage?: string;
  variantId?: string;
}) {
  const parts = [String(productId)];
  if (options?.variantId) {
    parts.push(options.variantId);
  }
  if (options?.color) {
    parts.push(options.color);
  }
  if (options?.storage) {
    parts.push(options.storage);
  }
  if (options?.condition) {
    parts.push(options.condition);
  }
  return parts.join('-');
}

export function resolveCurrentOffer(
  productData: NormalizedProductDetails,
  selectedCondition: ConditionType,
  selectedAttributes: Record<string, string>
): ProductDetailsCurrentOffer {
  let price = productData.rawPrice || 0;
  if (!price && typeof productData.price === 'string') {
    price =
      Number.parseInt(productData.price.replace(/[^0-9]/g, ''), 10) || 0;
  }

  let stock = productData.manage_stock ? (productData.stock ?? 0) : 999;

  if (
    selectedCondition.toLowerCase() !==
    (productData.condition || 'new').toLowerCase()
  ) {
    const offer = productData.offers?.find(
      (item) => item.condition.toLowerCase() === selectedCondition.toLowerCase()
    );

    if (offer) {
      price = offer.rawPrice;
      stock = offer.stock ?? offer.stock_quantity ?? stock;
    }
  }

  const selectedAttributeKeys = Object.keys(selectedAttributes);
  if (selectedAttributeKeys.length > 0 && productData.variants) {
    const variant = productData.variants.find((item) => {
      const attributes = item.attributes || {};
      return selectedAttributeKeys.every((key) => {
        const legacyValue = (item as unknown as Record<string, unknown>)[key];
        return (
          attributes[key] === selectedAttributes[key] ||
          legacyValue === selectedAttributes[key]
        );
      });
    });

    if (variant) {
      if (variant.price_override) {
        price = variant.price_override;
      } else if (variant.price_modifier) {
        price += variant.price_modifier;
      }

      if (variant.stock !== undefined) {
        stock = variant.stock;
      }
    }
  }

  return {
    price: `₦${price.toLocaleString()}`,
    rawPrice: price,
    stock,
    id: productData.id,
  };
}

export function getEffectiveAxes(
  serverProduct: Product,
  productData: NormalizedProductDetails
) {
  if (serverProduct.attributeAxes?.length) {
    return serverProduct.attributeAxes;
  }

  const axes: string[] = [];
  if (productData.storage.length > 0) {
    axes.push('storage');
  }
  if (productData.platforms.length > 0) {
    axes.push('platform');
  }
  return axes;
}

export function getAxisOptions(
  axis: string,
  productData: NormalizedProductDetails
) {
  if (axis === 'storage' && productData.storage.length > 0) {
    return productData.storage;
  }

  if (axis === 'platform' && productData.platforms.length > 0) {
    return productData.platforms;
  }

  if (!productData.variants) {
    return [];
  }

  return Array.from(
    new Set(
      productData.variants
        .map((variant) => variant.attributes?.[axis])
        .filter(Boolean)
    )
  ) as string[];
}

export function formatAxisLabel(axis: string) {
  const labels: Record<string, string> = {
    storage: 'Storage',
    ram: 'RAM',
    color: 'Color',
    platform: 'Platform',
    processor: 'Processor',
    gpu: 'GPU',
    sim_type: 'SIM Type',
  };

  return (
    labels[axis] ||
    `${axis.charAt(0).toUpperCase()}${axis.slice(1).replace(/_/g, ' ')}`
  );
}

export function getMissingSelectionFields(
  productData: NormalizedProductDetails,
  effectiveAxes: string[],
  selectedColor: number | null,
  selectedAttributes: Record<string, string>
) {
  const missing: string[] = [];

  if (selectedColor === null && productData.colors.length > 0) {
    missing.push('Color');
  }

  for (const axis of effectiveAxes.filter((item) => item !== 'color')) {
    if (
      !selectedAttributes[axis] &&
      getAxisOptions(axis, productData).length > 0
    ) {
      missing.push(formatAxisLabel(axis));
    }
  }

  return missing;
}

export function buildCartProduct(
  productData: NormalizedProductDetails,
  currentOffer: ProductDetailsCurrentOffer,
  selectedImage: number,
  selectedCondition: ConditionType,
  selectedAttributes: Record<string, string>
): CartProduct {
  const baseProduct = toRelatedProductsProduct(productData);

  return {
    ...baseProduct,
    price: currentOffer.rawPrice,
    image: productData.images[selectedImage],
    imageLarge: productData.images[selectedImage],
    description: productData.description,
    rating: productData.rating,
    category: productData.categories?.name || productData.category,
    condition: selectedCondition,
    ...selectedAttributes,
  };
}

export function getDeliveryEstimate(
  deliveryLocation: 'Lagos' | 'Outside Lagos',
  today = new Date()
) {
  const minDays = deliveryLocation === 'Lagos' ? 1 : 3;
  const maxDays = deliveryLocation === 'Lagos' ? 2 : 5;

  const formatDate = (daysToAdd: number) => {
    const date = new Date(today);
    date.setDate(today.getDate() + daysToAdd);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  return `${formatDate(minDays)} - ${formatDate(maxDays)}`;
}

export function buildDescriptionExcerpt(description: string) {
  const worthMatch = description.match(
    /<h2[^>]*>Why[^<]*Worth[^<]*<\/h2>\s*<p>([^<]+)/i
  );

  if (worthMatch?.[1]) {
    const benefitText = worthMatch[1].trim();
    return benefitText.length > 200
      ? `${benefitText.substring(0, 200)}...`
      : benefitText;
  }

  const secondParagraph = description.match(/<\/p>\s*<p>([^<]+)/);
  if (secondParagraph?.[1]) {
    const text = secondParagraph[1].trim();
    return text.length > 200 ? `${text.substring(0, 200)}...` : text;
  }

  const plainText = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const excerpt = plainText.split(/(?<=[.!?])\s+/).slice(2, 5).join(' ');

  if (excerpt) {
    return excerpt.length > 200 ? `${excerpt.substring(0, 200)}...` : excerpt;
  }

  return plainText ? `${plainText.substring(0, 200)}...` : '';
}
