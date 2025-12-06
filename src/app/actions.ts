'use server';

import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';

interface LandingMetrics {
  merchants: number;
  orders: number;
  sales: string | number;
  rating: number;
}

// Internal function to fetch metrics - serializable and cacheable
async function fetchMetricsInternal(): Promise<LandingMetrics> {
  try {
    // Use service client for public data to allow static generation (no cookies needed)
    const supabase = createServiceClient();

    // Execute queries in parallel
    const [merchantResult, orderResult, salesResult] = await Promise.all([
      supabase.from('merchants').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      // Fetch only necessary data for sales calculation
      // Note: For large datasets, this should be replaced with an RPC function
      // e.g., supabase.rpc('calculate_total_sales')
      supabase
        .from('orders')
        .select('total'),
    ]);

    const { count: merchantCount, error: merchantError } = merchantResult;
    const { count: orderCount, error: orderError } = orderResult;
    const { data: salesData, error: salesError } = salesResult;

    if (merchantError) {
      console.error('Error fetching merchant count:', merchantError);
    }
    if (orderError) {
      console.error('Error fetching order count:', orderError);
    }
    if (salesError) {
      console.error('Error fetching sales total:', salesError);
    }

    // Calculate total sales
    const totalSales =
      salesData?.reduce((sum, order) => sum + (Number(order.total) || 0), 0) ??
      0;

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
    return {
      merchants: 0,
      orders: 0,
      sales: '0',
      rating: 4.9,
    };
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
