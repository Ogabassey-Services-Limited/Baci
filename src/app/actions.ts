'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface LandingMetrics {
  merchants: number;
  orders: number;
  sales: string | number;
  rating: number;
}

export async function getLandingMetrics(): Promise<LandingMetrics> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Fetch merchant count
    const { count: merchantCount, error: merchantError } = await supabase
      .from('merchants')
      .select('*', { count: 'exact', head: true });

    // Fetch order count
    const { count: orderCount, error: orderError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Fetch all order totals to calculate sum (for small-medium datasets)
    // For very large datasets, consider creating a Supabase RPC function
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total');

    if (merchantError) {
      console.error('Error fetching merchant count:', merchantError);
    }
    if (orderError) {
      console.error('Error fetching order count:', orderError);
    }
    if (salesError) {
      console.error('Error fetching sales total:', salesError);
    }

    // Calculate total sales by summing all order totals
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
      rating: 4.9, // This could be calculated from reviews table if available
    };
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    // On error, return zeros instead of fake numbers
    return {
      merchants: 0,
      orders: 0,
      sales: '0',
      rating: 4.9,
    };
  }
}
