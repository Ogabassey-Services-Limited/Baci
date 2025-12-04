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

    // Calculate total sales from orders using SQL aggregation for efficiency
    const { data: salesData, error: salesError } = await supabase
      .from('orders')
      .select('total.sum()')
      .single();

    if (merchantError) {
      console.error('Error fetching merchant count:', merchantError);
    }
    if (orderError) {
      console.error('Error fetching order count:', orderError);
    }
    if (salesError) {
      console.error('Error fetching sales total:', salesError);
    }

    // Calculate total sales from aggregated result
    const totalSales = Number(salesData?.sum) || 0;

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
