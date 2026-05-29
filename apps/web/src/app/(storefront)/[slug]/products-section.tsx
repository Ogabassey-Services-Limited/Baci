import { getCachedProducts } from '@/lib/cached-data';
import type { Product } from '@/lib/products';

interface ProductsSectionProps {
  merchantId: string;
  categories?: { name: string; slug: string }[];
}

/**
 * Async Server Component for products.
 * Fetches data independently and streams when ready.
 * Wrapped in Suspense in parent for progressive loading.
 */
export async function ProductsSection({
  merchantId,
  categories = [],
}: ProductsSectionProps) {
  // Fetch products - this runs asynchronously and streams when ready
  const products = await getCachedProducts(merchantId, {
    includeVariants: false,
    limit: 50,
  });

  // Return products and categories for the template to render
  return { products: products as unknown as Product[], categories };
}

/**
 * Type for the resolved data from ProductsSection
 */
export type ProductsSectionData = {
  products: Product[];
  categories: { name: string; slug: string }[];
};
