import { unstable_cache } from 'next/cache';
import type { CurrencyConfig } from '@/lib/currency';
import { createPublicClient } from '@/lib/supabase/public';

// Cache duration: 5 minutes (matching CACHE_DURATIONS.products)
const CACHE_TTL = 300;
const DEFAULT_SANTA_CURRENCY: CurrencyConfig = {
  code: 'NGN',
  locale: 'en-NG',
  symbol: '₦',
};

const SANTA_BUCKET_LIMITS = [30, 50, 80, 100, 80, 80, 50, 30] as const;
const SANTA_DISCOUNT_SAFETY_MARGIN_RATIO = 0.01;

/**
 * Validated product shape from DB
 */
export type ProductRow = {
  name: string;
  price: number;
  cost_price: number | null;
};

export function selectSantaCatalogProducts(
  products: ProductRow[]
): ProductRow[] {
  if (!products.length) return [];

  const bucketSize = Math.ceil(products.length / SANTA_BUCKET_LIMITS.length);
  const selectedProducts = SANTA_BUCKET_LIMITS.flatMap((limit, index) =>
    products.slice(index * bucketSize, (index + 1) * bucketSize).slice(0, limit)
  );

  return Array.from(
    new Map(selectedProducts.map((product) => [product.name, product])).values()
  );
}

export function calculateSantaMaxDiscountPercentage(
  price: number,
  costPrice: number
): number {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(costPrice)) {
    return 0;
  }

  const discountPercentage = Math.floor(
    ((price - costPrice - price * SANTA_DISCOUNT_SAFETY_MARGIN_RATIO) / price) *
      100 +
      1e-9
  );

  return Math.max(Math.min(discountPercentage, 40), 0);
}

export function formatSantaProductPrice(
  price: number,
  currency: CurrencyConfig
): string {
  return `${price.toLocaleString(currency.locale)} ${currency.code}`;
}

/**
 * Fetch and bucket products returning raw array
 */
const fetchSantaProductList = async (
  merchantId: string
): Promise<ProductRow[]> => {
  try {
    const supabase = createPublicClient({
      clientInfo: 'baci-santa-catalog',
      timeoutMs: 4000,
    });

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

    // Select representative price ranks rather than currency-specific ranges.
    return selectSantaCatalogProducts(products);
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
      if (p.cost_price !== null) {
        const costPrice = Number(p.cost_price) || 0;
        const safeDiscount = calculateSantaMaxDiscountPercentage(
          price,
          costPrice
        );
        return `*   ${productName}: ${formatSantaProductPrice(price, currency)} (Max Discount: ${safeDiscount}%) [HAS_COST]`;
      }
      return `*   ${productName}: ${formatSantaProductPrice(price, currency)} (Max Discount: 40%) [FLEX]`;
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
