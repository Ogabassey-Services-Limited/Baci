import { unstable_cache } from 'next/cache';
import type { CurrencyConfig } from '@/lib/currency';
import { createAdminClient } from '@/lib/supabase/admin';

// Cache duration: 5 minutes (matching CACHE_DURATIONS.products)
const CACHE_TTL = 300;
const DEFAULT_SANTA_CURRENCY: CurrencyConfig = {
  code: 'NGN',
  locale: 'en-NG',
  symbol: '₦',
};

/**
 * Validated product shape from DB
 */
export type ProductRow = {
  name: string;
  price: number;
  cost_price: number | null;
};

/**
 * Fetch and bucket products returning raw array
 */
const fetchSantaProductList = async (
  merchantId: string
): Promise<ProductRow[]> => {
  try {
    const supabase = createAdminClient();

    // 1. Single DB Query: Fetch ALL active products for this merchant
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('name, price, cost_price')
      .eq('merchant_id', merchantId)
      .eq('status', 'active')
      .order('price', { ascending: false })
      .limit(5000);

    if (error) {
      console.error('[Santa Data] Error fetching products:', error);
      return [];
    }

    const products = (allProducts as unknown as ProductRow[]) || [];

    // 2. Define Price Ranges (Buckets)
    const priceRanges = [
      { min: 5000000, max: 999999999, limit: 30 },
      { min: 2000000, max: 5000000, limit: 50 },
      { min: 1200000, max: 2000000, limit: 80 },
      { min: 800000, max: 1200000, limit: 100 },
      { min: 500000, max: 800000, limit: 80 },
      { min: 200000, max: 500000, limit: 80 },
      { min: 50000, max: 200000, limit: 50 },
      { min: 0, max: 50000, limit: 30 },
    ];

    const selectedProducts: ProductRow[] = [];

    // 3. In-Memory Bucketing & Selection
    for (const range of priceRanges) {
      const productsInRange = products.filter(
        (p) => (p.price ?? 0) >= range.min && (p.price ?? 0) < range.max
      );
      const topProducts = productsInRange.slice(0, range.limit);
      selectedProducts.push(...topProducts);
    }

    // 4. Deduplicate
    const uniqueProducts = Array.from(
      new Map(selectedProducts.map((p) => [p.name, p])).values()
    );

    return uniqueProducts;
  } catch (err) {
    console.error('[Santa Data] Unexpected error:', err);
    return [];
  }
};

/**
 * Cached function to get the raw product list
 */
export const getCachedSantaProductList = unstable_cache(
  fetchSantaProductList,
  ['santa-product-list'],
  {
    revalidate: CACHE_TTL,
    tags: ['products'],
  }
);

/**
 * Formats the product list into the prompt string
 */
const formatSantaCatalog = async (
  merchantId: string,
  currency: CurrencyConfig = DEFAULT_SANTA_CURRENCY
): Promise<string> => {
  // Call the raw fetcher directly to avoid double-caching (this function is itself cached)
  const products = await fetchSantaProductList(merchantId);

  if (!products.length) return '(No products available)';

  // Format for LLM Prompt — use discount percentage floors instead of absolute cost prices
  // to prevent cost data exposure via prompt injection
  return products
    .map((p) => {
      const price = Number(p.price) || 0;
      const productName = JSON.stringify(p.name);
      if (p.cost_price) {
        const costPrice = Number(p.cost_price) || 0;
        const maxDiscountPct = Math.min(
          Math.floor(((price - costPrice - 10000) / price) * 100),
          40
        );
        const safeDiscount = Math.max(maxDiscountPct, 0);
        return `*   ${productName}: ${currency.symbol}${price.toLocaleString(currency.locale)} (Max Discount: ${safeDiscount}%) [HAS_COST]`;
      }
      return `*   ${productName}: ${currency.symbol}${price.toLocaleString(currency.locale)} (Max Discount: 40%) [FLEX]`;
    })
    .join('\n');
};

/**
 * @deprecated Use getCachedSantaProductList for raw data if needed
 * Generates the Santa product catalog STRING for the prompt
 */
export const getCachedSantaProducts = unstable_cache(
  formatSantaCatalog,
  ['santa-products-catalog-string'],
  {
    revalidate: CACHE_TTL,
    tags: ['products'],
  }
);
