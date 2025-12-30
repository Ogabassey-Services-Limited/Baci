import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';
import type { ShippingStatus } from '@baci/shared';

export interface OrderCounts {
    all: number;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    returned: number;
}

async function fetchOrderCounts(merchantId: string): Promise<OrderCounts> {
    // We perform parallel queries for each status to get exact counts
    // This is more efficient than fetching all orders and filtering client-side for large datasets,
    // though for small shops, client-side might be fine. We stick to server-side counts for scalability.

    const queries = [
        // All orders
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId),

        // Pending
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('shipping_status', 'pending'),

        // Processing
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('shipping_status', 'processing'),

        // Shipped
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('shipping_status', 'shipped'),

        // Delivered
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('shipping_status', 'delivered'),

        // Cancelled
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('shipping_status', 'cancelled'),

        // Returned
        supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('merchant_id', merchantId)
            .eq('shipping_status', 'returned'),
    ];

    const results = await Promise.all(queries);

    // Extract counts, defaulting to 0 if error or null
    return {
        all: results[0].count ?? 0,
        pending: results[1].count ?? 0,
        processing: results[2].count ?? 0,
        shipped: results[3].count ?? 0,
        delivered: results[4].count ?? 0,
        cancelled: results[5].count ?? 0,
        returned: results[6].count ?? 0,
    };
}

export function useOrderCounts() {
    const { merchant } = useMerchant();
    const merchantId = merchant?.id;

    return useQuery({
        queryKey: ['order-counts', merchantId],
        queryFn: () => fetchOrderCounts(merchantId!),
        enabled: !!merchantId,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}
