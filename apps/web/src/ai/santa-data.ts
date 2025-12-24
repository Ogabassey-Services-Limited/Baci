import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Santa product data with pricing rules
 */
export interface SantaProduct {
  name: string;
  price: number;
  cost_price: number | null;
}

/**
 * Price ranges for fetching products across different categories
 * Ensures good coverage of TVs, laptops, flagship phones, mid-range phones, and accessories
 */
const PRICE_RANGES = [
  { min: 5000000, max: 999999999, limit: 30 }, // Premium TVs & gaming laptops
  { min: 2000000, max: 5000000, limit: 50 }, // High-end laptops & MacBooks
  { min: 1200000, max: 2000000, limit: 80 }, // High-end phones & laptops
  { min: 800000, max: 1200000, limit: 100 }, // Flagship phones (S24 Ultra at ₦980K is here!)
  { min: 500000, max: 800000, limit: 80 }, // Mid-range phones
  { min: 200000, max: 500000, limit: 80 }, // Budget phones
  { min: 50000, max: 200000, limit: 50 }, // Accessories & budget items
  { min: 0, max: 50000, limit: 30 }, // Small accessories
] as const;

/**
 * Fetch Santa products from database with parallel queries
 * Exported for use by product lookup route
 */
export async function fetchSantaProducts(
  merchantId: string
): Promise<SantaProduct[]> {
  const supabase = createServiceClient();

  // Execute all price range queries in parallel
  const results = await Promise.all(
    PRICE_RANGES.map((range) =>
      supabase
        .from('products')
        .select('name, price, cost_price')
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .gte('price', range.min)
        .lt('price', range.max)
        .order('price', { ascending: false })
        .limit(range.limit)
    )
  );

  // Aggregate all products and handle errors
  const allProducts: SantaProduct[] = [];
  for (const result of results) {
    if (result.error) {
      console.error('[Santa Data] Query error:', result.error);
      continue;
    }
    if (result.data) {
      allProducts.push(...result.data);
    }
  }

  // Deduplicate by name (in case of edge cases at range boundaries)
  const uniqueProducts = Array.from(
    new Map(allProducts.map((p) => [p.name, p])).values()
  );

  console.log(`[Santa Data] Fetched ${uniqueProducts.length} unique products`);
  return uniqueProducts;
}

/**
 * Cached Santa products fetch
 * Uses Next.js unstable_cache with 5-minute TTL for performance
 *
 * @param merchantId - The merchant ID to fetch products for
 * @returns Array of products with name, price, and cost_price
 */
export const getCachedSantaProducts = unstable_cache(
  (merchantId: string): Promise<SantaProduct[]> => {
    return fetchSantaProducts(merchantId);
  },
  ['santa-products'],
  {
    revalidate: 300, // 5 minutes TTL
    tags: ['santa-products'],
  }
);

/**
 * Format products into Santa prompt format
 * Products are marked with [HAS_COST] or [FLEX] based on pricing rules
 */
export function formatSantaProductList(products: SantaProduct[]): string {
  if (products.length === 0) {
    return '(No products available)';
  }

  return products
    .map((p) => {
      const price = Number(p.price) || 0;
      if (p.cost_price) {
        // Product has cost price - use min approved price rule
        const minPrice = (Number(p.cost_price) || 0) + 10000;
        return `*   ${p.name}: ₦${price.toLocaleString()} (Min Approved: ₦${minPrice.toLocaleString()}) [HAS_COST]`;
      } else {
        // No cost price - use percentage discount rule (max 40% off selling price)
        const minPrice = Math.round(price * 0.6); // 40% max discount
        return `*   ${p.name}: ₦${price.toLocaleString()} (Min: ₦${minPrice.toLocaleString()}) [FLEX]`;
      }
    })
    .join('\n');
}

/**
 * Get the formatted Santa product catalog for the prompt
 * Combines fetching and formatting in one call
 */
export async function getSantaProductCatalog(
  merchantId: string
): Promise<string> {
  const products = await getCachedSantaProducts(merchantId);
  return formatSantaProductList(products);
}
