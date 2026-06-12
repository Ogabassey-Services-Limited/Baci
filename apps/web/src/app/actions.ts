// Server-only module (NOT a server action): the sole consumer is the
// server-rendered landing page (`src/app/page.tsx`). Dropping 'use server'
// removes the public, unauthenticated RPC endpoint entirely, and avoids
// request APIs (cookies/headers) during render — the homepage must stay
// statically prerenderable under `cacheComponents` (see the service-client
// comment in fetchMetricsInternal).
import 'server-only';

import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';

interface LandingMetrics {
  merchants: number;
  orders: number;
  sales: string | number;
  rating: number;
}

const FALLBACK_METRICS: LandingMetrics = {
  merchants: 0,
  orders: 0,
  sales: '0',
  rating: 4.9,
};

// Internal function to fetch metrics - serializable and cacheable
async function fetchMetricsInternal(): Promise<LandingMetrics> {
  try {
    // Use service client for public data to allow static generation (no cookies needed)
    const supabase = createServiceClient();

    // Execute queries in parallel - use RPC for sales to avoid fetching all orders
    const [merchantResult, orderResult, salesResult] = await Promise.all([
      supabase.from('merchants').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      // Use RPC function instead of fetching all orders (huge performance improvement)
      supabase.rpc('get_total_sales'),
    ]);

    const { count: merchantCount, error: merchantError } = merchantResult;
    const { count: orderCount, error: orderError } = orderResult;
    const { data: salesTotal, error: salesError } = salesResult;

    if (merchantError) {
      console.error('Error fetching merchant count:', merchantError);
    }
    if (orderError) {
      console.error('Error fetching order count:', orderError);
    }
    if (salesError) {
      console.error('Error fetching sales total:', salesError);
    }

    // Use RPC result directly (returns a number in kobo/cents)
    const totalSales = typeof salesTotal === 'number' ? salesTotal / 100 : 0;

    // Format sales display
    let salesDisplay: string | number;
    if (totalSales >= 1000000) {
      salesDisplay = `${(totalSales / 1000000).toFixed(1)}M`;
    } else if (totalSales >= 1000) {
      salesDisplay = `${(totalSales / 1000).toFixed(1)}K`;
    } else {
      salesDisplay = totalSales.toFixed(0);
    }

    return {
      merchants: merchantCount ?? 0,
      orders: orderCount ?? 0,
      sales: salesDisplay,
      rating: 4.9,
    };
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    return { ...FALLBACK_METRICS };
  }
}

// Cached version of the metrics fetcher
const getCachedMetrics = unstable_cache(
  async () => fetchMetricsInternal(),
  ['landing-metrics'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['landing-metrics'],
  }
);

export async function getLandingMetrics(): Promise<LandingMetrics> {
  return await getCachedMetrics();
}
