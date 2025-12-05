/**
 * @fileOverview Universal Product Adapter
 *
 * A single adapter that transforms Baci engine products to a format
 * that works with ALL templates. Templates can use this directly
 * without needing their own adapters.
 */

import type { Product as BaciProduct } from '@/lib/products';

/**
 * Universal template product format
 * Includes all fields any template might need
 */
export interface TemplateProduct {
  id: string;
  name: string;
  price: string; // Formatted price string (e.g., "₦1,950,000")
  rawPrice: number; // Numeric price in Naira for filtering
  image: string;
  imageLarge?: string;
  images?: string[];
  category: string;
  description: string;
  brand?: string;
  rating: number;
  reviews: number;
  condition: 'New' | 'Used' | 'Open Box';
  inStock: boolean;
  isNew?: boolean;
  specs?: Record<string, string>;
  // Additional fields for compatibility
  status?: string;
  manage_stock?: boolean;
  stock?: number;
  colors?: string[];
  storage?: string;
  ram?: string;
  displayType?: string;
  displaySize?: string;
  simType?: string;
}

/**
 * Format price as Nigerian Naira string
 */
function formatPrice(priceInKobo: number): string {
  const priceInNaira = priceInKobo / 100;
  return `₦${priceInNaira.toLocaleString('en-NG')}`;
}

/**
 * Map Baci condition to template condition format
 */
function mapCondition(
  condition?: 'new' | 'used',
  conditionDetail?: string
): 'New' | 'Used' | 'Open Box' {
  if (condition === 'new') return 'New';
  if (conditionDetail?.toLowerCase().includes('open box')) return 'Open Box';
  return 'Used';
}

/**
 * Extract rating from schema markup if available
 */
function extractRating(product: BaciProduct): number {
  const schemaRating = product.schema_markup?.aggregateRating;
  if (
    schemaRating &&
    typeof schemaRating === 'object' &&
    'ratingValue' in schemaRating
  ) {
    return Number(schemaRating.ratingValue) || 4.5;
  }
  return 4.5;
}

/**
 * Extract colors from variants
 */
function extractColors(product: BaciProduct): string[] | undefined {
  if (!product.variants || product.variants.length === 0) return undefined;
  const colors = product.variants
    .map((v) => v.attributes?.color)
    .filter((c): c is string => typeof c === 'string');
  return colors.length > 0 ? colors : undefined;
}

/**
 * Parse specs string into key-value pairs
 */
function parseSpecs(specs: string): Record<string, string> | undefined {
  if (!specs) return undefined;

  const result: Record<string, string> = {};

  const storageMatch = specs.match(/(\d+)\s*(GB|TB)/i);
  if (storageMatch) {
    result.storage = `${storageMatch[1]}${storageMatch[2].toUpperCase()}`;
  }

  const ramMatch = specs.match(/(\d+)\s*GB\s*RAM/i);
  if (ramMatch) {
    result.ram = `${ramMatch[1]}GB`;
  }

  const screenMatch = specs.match(/(\d+\.?\d*)\s*["'']/);
  if (screenMatch) {
    result.screen = `${screenMatch[1]}"`;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Adapt a single Baci product to universal template format
 */
export function adaptProduct(product: BaciProduct): TemplateProduct {
  return {
    id: product.id,
    name: product.name,
    price: formatPrice(product.price),
    rawPrice: product.price / 100,
    image: product.image,
    imageLarge: product.imageLarge,
    images: product.images?.map((img) => img.url),
    category: product.category || 'General',
    description: product.description,
    brand: product.brand,
    rating: extractRating(product),
    reviews: 0,
    condition: mapCondition(product.condition, product.condition_detail),
    inStock: product.manage_stock ? (product.stock ?? 0) > 0 : true,
    isNew: product.condition === 'new',
    specs: product.specs ? parseSpecs(product.specs) : undefined,
    status: product.status,
    manage_stock: product.manage_stock,
    stock: product.stock,
    colors: extractColors(product),
    storage: product.specs ? parseSpecs(product.specs)?.storage : undefined,
    displaySize: product.size_attribute,
  };
}

/**
 * Adapt an array of Baci products to template format
 */
export function adaptProducts(products: BaciProduct[]): TemplateProduct[] {
  return products.map(adaptProduct);
}

/**
 * Convert TemplateProduct back to cart-compatible format
 */
export function toCartProduct(product: TemplateProduct) {
  return {
    id: product.id,
    name: product.name,
    price: product.rawPrice * 100, // Convert back to kobo
    image: product.image,
    description: product.description,
    brand: product.brand || '',
    status: 'active' as const,
    manage_stock: product.manage_stock ?? false,
    stock: product.stock ?? 999,
    imageLarge: product.imageLarge || product.image,
    imageHint: product.name,
    gtin: '',
    mpn: '',
  };
}
