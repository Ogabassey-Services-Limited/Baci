
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

export interface FailedOrder {
    id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    total: number;
    payment_status: 'bnpl_pending' | 'failed';
    payment_method: string;
    created_at: string;
    gateway_response?: any;
}

export function useFailedOrders() {
    const { merchant } = useMerchant();
    const merchantId = merchant?.id;

    return useQuery({
        queryKey: ['failed-orders', merchantId],
        queryFn: async () => {
            // Fetch orders with failed or bnpl_pending status
            // We also try to join with transactions to get the gateway response if available
            const { data, error } = await supabase
                .from('orders')
                .select(`
          id,
          order_number,
          customer_name,
          customer_email,
          customer_phone,
          total,
          payment_status,
          payment_method,
          created_at,
          transactions (
            gateway_response,
            status,
            gateway
          )
        `)
                .eq('merchant_id', merchantId)
                .in('payment_status', ['bnpl_pending', 'failed'])
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to include the most relevant transaction error
            return data.map((order: any) => {
                // Find a failed transaction or the most recent one
                const transaction = order.transactions?.[0]; // Assuming ordered by recent, or we can sort if needed

                return {
                    id: order.id,
                    order_number: order.order_number,
                    customer_name: order.customer_name,
                    customer_email: order.customer_email,
                    customer_phone: order.customer_phone,
                    total: order.total,
                    payment_status: order.payment_status,
                    payment_method: order.payment_method,
                    created_at: order.created_at,
                    gateway_response: transaction?.gateway_response,
                    gateway: transaction?.gateway,
                } as FailedOrder;
            });
        },
        enabled: !!merchantId,
        staleTime: 1000 * 60 * 2, // 2 minutes
    });
}
