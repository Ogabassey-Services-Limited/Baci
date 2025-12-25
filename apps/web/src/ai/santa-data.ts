
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

// Cache duration: 5 minutes (matching CACHE_DURATIONS.products)
const CACHE_TTL = 300;

/**
 * Validated product shape from DB
 */
type ProductRow = {
  name: string;
  price: number;
  cost_price: number | null;
};

/**
 * Internal fetch function - exported for testing/verification scripts
 */
export const fetchSantaProducts = async (merchantId: string): Promise<string> => {
  try {
    const supabase = createAdminClient();

    // 1. Single DB Query: Fetch ALL active products for this merchant
    // efficient for ~1000 items
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('name, price, cost_price')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('price', { ascending: false })
      .limit(5000); // Ensure we get full catalogue (default is 1000)

    if (error) {
      console.error('[Santa Data] Error fetching products:', error);
      return '(Error fetching product catalog)';
    }

    const products = (allProducts as unknown as ProductRow[]) || [];
    console.log(`[Santa Data] Fetched ${products.length} total active products`);

    // 2. Define Price Ranges (Buckets)
    const priceRanges = [
      { min: 5000000, max: 999999999, limit: 30 },  // Premium
      { min: 2000000, max: 5000000, limit: 50 },    // High-end
      { min: 1200000, max: 2000000, limit: 80 },    // High-end Phones
      { min: 800000, max: 1200000, limit: 100 },    // Flagships (S24 Ultra here)
      { min: 500000, max: 800000, limit: 80 },      // Mid-range
      { min: 200000, max: 500000, limit: 80 },      // Budget
      { min: 50000, max: 200000, limit: 50 },       // Accessories
      { min: 0, max: 50000, limit: 30 },            // Small items
    ];

    const selectedProducts: ProductRow[] = [];

    // 3. In-Memory Bucketing & Selection
    // We iterate through our buckets and pick top items from the full list
    for (const range of priceRanges) {
      const productsInRange = products.filter(
        p => (p.price ?? 0) >= range.min && (p.price ?? 0) < range.max
      );

      // They are already sorted by price desc from DB query
      const topProducts = productsInRange.slice(0, range.limit);
      selectedProducts.push(...topProducts);
    }

    // 4. Deduplicate (just in case)
    const uniqueProducts = Array.from(
      new Map(selectedProducts.map(p => [p.name, p])).values()
    );
    console.log(`[Santa Data] Selected ${uniqueProducts.length} items for context`);

    // 5. Format for LLM Prompt
    const productList = uniqueProducts
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
      .join('\n') || '(No products available)';

    return productList;

  } catch (err) {
    console.error('[Santa Data] Unexpected error:', err);
    return '(Error generating catalog)';
  }
};

/**
 * Generates the Santa product catalog string by fetching ALL active products
 * and bucketing them in-memory. reducing DB calls from 8 to 1.
 */
export const getCachedSantaProducts = unstable_cache(
  fetchSantaProducts,
  ['santa-products-catalog'],
  {
    revalidate: CACHE_TTL,
    tags: ['products'] // Invalidate when products change
  }
);
