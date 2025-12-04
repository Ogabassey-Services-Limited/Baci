import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Social Proof API
 *
 * GET - Returns social proof data for a product (recent sales, purchases, trending status)
 *
 * Query params:
 * - productId: string (required)
 * - merchantId: string (required)
 */

interface RecentPurchase {
  id: string;
  city: string;
  timeAgo: string;
  productName?: string;
}

// Nigerian cities for anonymized display
const NIGERIAN_CITIES = [
  'Lagos',
  'Abuja',
  'Port Harcourt',
  'Ibadan',
  'Kano',
  'Benin City',
  'Enugu',
  'Kaduna',
  'Warri',
  'Ilorin',
  'Jos',
  'Owerri',
  'Calabar',
  'Uyo',
  'Abeokuta',
  'Onitsha',
  'Aba',
  'Zaria',
  'Maiduguri',
  'Akure',
];

function getRandomCity(): string {
  return NIGERIAN_CITIES[Math.floor(Math.random() * NIGERIAN_CITIES.length)];
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
  return 'recently';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const merchantId = searchParams.get('merchantId');

    if (!productId || !merchantId) {
      return NextResponse.json(
        { error: 'productId and merchantId are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get recent orders for this product (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentOrders, error } = await supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        created_at,
        orders!inner (
          id,
          merchant_id,
          shipping_city,
          created_at,
          payment_status
        )
      `)
      .eq('product_id', productId)
      .eq('orders.merchant_id', merchantId)
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching social proof data:', error);
      // Return empty data on error rather than failing
      return NextResponse.json({
        recentSales: 0,
        recentPurchases: [],
        trending: false,
      });
    }

    // Calculate recent sales count
    const recentSales =
      recentOrders?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

    // Format recent purchases (anonymized)
    const recentPurchases: RecentPurchase[] = (recentOrders || [])
      .slice(0, 5)
      .map((item, index) => {
        // orders can be array or single object depending on supabase response
        const orderArray = item.orders as unknown as
          | Array<{ shipping_city?: string; created_at: string }>
          | { shipping_city?: string; created_at: string }
          | null;
        const orderData = Array.isArray(orderArray)
          ? orderArray[0]
          : orderArray;
        return {
          id: `purchase-${index}`,
          city: orderData?.shipping_city || getRandomCity(),
          timeAgo: formatTimeAgo(
            new Date(orderData?.created_at || item.created_at)
          ),
        };
      });

    // Determine if product is trending (more than 5 sales in 7 days)
    const trending = recentSales >= 5;

    // Get 24-hour sales count for the "X sold in last 24 hours" display
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: dailyOrders } = await supabase
      .from('order_items')
      .select(`
        quantity,
        orders!inner (
          merchant_id,
          created_at,
          payment_status
        )
      `)
      .eq('product_id', productId)
      .eq('orders.merchant_id', merchantId)
      .eq('orders.payment_status', 'paid')
      .gte('orders.created_at', oneDayAgo.toISOString());

    const dailySales =
      dailyOrders?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

    return NextResponse.json({
      recentSales: dailySales, // Sales in last 24 hours
      weekSales: recentSales, // Sales in last 7 days
      recentPurchases,
      trending,
    });
  } catch (error) {
    console.error('Social proof API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
