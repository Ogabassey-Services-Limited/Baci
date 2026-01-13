/**
 * Product types for the mobile app
 * Mirrors the web storefront types for consistency
 */

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compare_at_price?: number;
  image: string;
  images?: string[];
  brand?: string;
  category?: string;
  condition?:
    | 'New'
    | 'UK Used'
    | 'Refurbished'
    | 'Open Box'
    | 'Used'
    | 'New & Used';
  rating?: number;
  review_count?: number;
  in_stock?: boolean;
  stock_quantity?: number;
  has_variants?: boolean;
  colors?: (string | { name: string; value: string })[];
  variant_attributes?: Record<string, string[]>;
  variants?: ProductVariant[];
  specifications?: Record<string, string>;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  compare_at_price?: number;
  image?: string;
  images?: string[];
  color?: string;
  storage?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  attributes?: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  product_count?: number;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  link?: string;
  background_color?: string;
}

/**
 * Format price in Nigerian Naira
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate discount percentage
 */
export function getDiscountPercentage(
  price: number,
  compareAtPrice?: number
): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}
