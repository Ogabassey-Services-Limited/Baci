import { applyOrderBranchScope } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ALL_BRANCH_SCOPE, type BranchScope } from '@/schemas/branch';
import type { TopProduct } from './dashboard-stats.types';

export async function fetchTopProducts(
  merchantId: string,
  limit: number = 5,
  scope: BranchScope = ALL_BRANCH_SCOPE
): Promise<TopProduct[]> {
  const startDate = new Date(0).toISOString();
  const endDate = new Date().toISOString();

  const fetchFromOrderItems = async () => {
    const orderColumns =
      scope.type === 'branch' ? 'merchant_id, branch_id' : 'merchant_id';
    let orderItemsQuery = supabase
      .from('order_items')
      .select(`
        quantity,
        price,
        product_id,
        products!inner(id, name, price, images),
        orders!inner(${orderColumns})
      `)
      .eq('orders.merchant_id', merchantId);

    orderItemsQuery = applyOrderBranchScope(
      orderItemsQuery,
      scope,
      'orders.branch_id'
    );

    const { data: orderItems, error: orderItemsError } = await orderItemsQuery;
    if (orderItemsError) {
      throw new Error(
        `fetchTopProducts order_items query failed: ${orderItemsError.message}`
      );
    }

    if (!orderItems) return [];

    const productMap = new Map<
      string,
      {
        id: string;
        name: string;
        price: number;
        images: string[];
        totalSold: number;
        totalRevenue: number;
      }
    >();

    for (const item of orderItems) {
      const productRaw = item.products;
      if (!productRaw) continue;

      const product = (
        Array.isArray(productRaw) ? productRaw[0] : productRaw
      ) as { id: string; name: string; price: number; images: string[] };
      if (!product?.id) continue;

      const existing = productMap.get(product.id);
      if (existing) {
        existing.totalSold += item.quantity || 1;
        existing.totalRevenue += (item.quantity || 1) * (item.price || 0);
      } else {
        productMap.set(product.id, {
          id: product.id,
          images: product.images || [],
          name: product.name,
          price: product.price,
          totalRevenue: (item.quantity || 1) * (item.price || 0),
          totalSold: item.quantity || 1,
        });
      }
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        imageUrl: p.images[0] || null,
        name: p.name,
        price: p.price,
        totalRevenue: p.totalRevenue,
        totalSold: p.totalSold,
      }));
  };

  if (scope.type === 'branch') {
    return fetchFromOrderItems();
  }

  const { data, error } = await supabase.rpc('get_top_products', {
    p_end_date: endDate,
    p_limit: limit,
    p_merchant_id: merchantId,
    p_start_date: startDate,
  });

  if (error) {
    if (__DEV__) {
      console.log('[DashboardStats] RPC not available, using fallback query');
    }
    return fetchFromOrderItems();
  }

  return (data || []).map(
    (p: {
      id: string;
      name: string;
      price: number;
      image_url: string;
      total_sold: number;
      total_revenue: number;
    }) => ({
      id: p.id,
      imageUrl: p.image_url,
      name: p.name,
      price: p.price,
      totalRevenue: p.total_revenue,
      totalSold: p.total_sold,
    })
  );
}
