import { cookies } from 'next/headers';
import { Suspense } from 'react';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import type { CachedMerchant } from '@/lib/cached-data';
import { getPlaceDetailsServer } from '@/lib/google-places';
import type { Product } from '@/lib/products';
import { createClient } from '@/lib/supabase/server';
import { StorefrontWrapper } from './storefront-wrapper';

// Google Place ID for Ogabassey (TODO: Move to merchant config)
const OGABASSEY_PLACE_ID = 'ChIJychoUsKNOxARHWCwVgvx670';

interface StorefrontContentProps {
  merchant: CachedMerchant;
  initialTheme?: V2ThemeMode;
}

/**
 * Async Server Component that handles the heavy data fetching.
 * This component streams after the page shell is sent.
 * Wrapped in Suspense in the parent page.tsx.
 */
export async function StorefrontContent({
  merchant,
  initialTheme,
}: StorefrontContentProps) {
  // Parallel data fetching for all non-critical data
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Define fetches
  const productsPromise = supabase
    .from('products')
    .select(
      `
      id,
      name,
      slug,
      description,
      price,
      compare_at_price,
      images,
      category,
      brand,
      condition,
      stock,
      product_categories(
        categories(name, slug)
      )
    `
    )
    .eq('merchant_id', merchant.id)
    .eq('status', 'active')
    .order('price', { ascending: false })
    .limit(50); // Reduced from 500 for faster initial load

  const categoriesPromise = getCachedNavigationCategories(merchant.id);

  // Only fetch Google Places for specific merchants
  const shouldFetchPlaces =
    merchant.slug === 'ogabassey' || merchant.slug === 'gadget-universe-demo';

  // Execute all in parallel
  const [productsResult, categories] = await Promise.all([
    productsPromise,
    categoriesPromise,
  ]);

  // Optionally fetch Google Places (don't block on it)
  let placeDetails = null;
  if (shouldFetchPlaces) {
    try {
      placeDetails = await getPlaceDetailsServer(OGABASSEY_PLACE_ID);
    } catch (err) {
      console.error('[StorefrontContent] Google Places error:', err);
    }
  }

  const { data: products } = productsResult;

  // Transform products to match expected interface
  // biome-ignore lint/suspicious/noExplicitAny: DB result shape differs from Product interface
  const merchantProducts: Product[] = (products || []).map((p: any) => ({
    ...p,
    categories: p.product_categories?.[0]?.categories || null,
    product_categories: undefined,
  })) as unknown as Product[];

  return (
    <StorefrontWrapper
      products={merchantProducts}
      categories={categories || []}
      initialTheme={initialTheme}
    />
  );
}

/**
 * Wrapper component with Suspense for streaming
 */
export function StreamingStorefrontContent(props: StorefrontContentProps) {
  return (
    <Suspense fallback={<StorefrontPageSkeleton />}>
      <StorefrontContent {...props} />
    </Suspense>
  );
}
