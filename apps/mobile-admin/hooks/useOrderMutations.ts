import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ORDER_COLUMNS } from '@/constants/order-columns';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedHeaders, readResponseError, runWithTimeout } from './order-request';
import type { Order, OrdersPage, ShippingStatus } from './order-types';
import { useMerchant } from './useMerchant';

async function updateOrderStatus(
  orderId: string,
  status: ShippingStatus,
  merchantId: string
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ shipping_status: status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .select(ORDER_COLUMNS);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error('Order not found');
  }

  return data[0];
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['updateOrderStatus'],
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: ShippingStatus;
    }) => {
      if (!merchant?.id) {
        throw new Error('Merchant ID is required');
      }
      return updateOrderStatus(orderId, status, merchant.id);
    },
    onMutate: async ({ orderId, status }) => {
      if (!merchant?.id) {
        return { previousOrders: [], previousOrder: undefined };
      }

      await queryClient.cancelQueries({ queryKey: ['orders', merchant.id] });

      const previousOrders = queryClient.getQueriesData<OrdersPage>({
        queryKey: ['orders', merchant.id],
      });

      queryClient.setQueriesData<InfiniteData<OrdersPage>>(
        { queryKey: ['orders', merchant.id] },
        (old) => {
          if (!old?.pages) {
            return old;
          }

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              orders: page.orders.map((order) =>
                order.id === orderId
                  ? { ...order, shipping_status: status }
                  : order
              ),
            })),
          };
        }
      );

      const previousOrder = queryClient.getQueryData(['order', orderId]);
      queryClient.setQueryData(['order', orderId], (old: Order | undefined) => {
        if (!old) {
          return old;
        }

        return { ...old, shipping_status: status };
      });

      return { previousOrders, previousOrder };
    },
    onError: (_err, vars, context) => {
      if (context?.previousOrders) {
        context.previousOrders.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      if (context?.previousOrder) {
        queryClient.setQueryData(
          ['order', vars.orderId],
          context.previousOrder
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
    },
  });
}

export function useShipOnCredit() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['shipOnCredit'],
    mutationFn: async ({
      orderId,
      creditNotes,
    }: {
      orderId: string;
      creditNotes?: string;
    }) => {
      const response = await fetch(`${BASE_URL}/api/orders/${orderId}/ship-on-credit`, {
        method: 'POST',
        headers: await getAuthenticatedHeaders(),
        body: JSON.stringify({ credit_notes: creditNotes }),
      });

      if (!response.ok) {
        throw new Error(
          await readResponseError(
            response,
            `Request failed: ${response.status} ${response.statusText}`
          )
        );
      }

      return response.json();
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
    },
  });
}

export function useSendReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['sendReminder'],
    mutationFn: async ({
      orderId,
      channel = 'email',
      message = '',
    }: {
      orderId: string;
      channel?: 'email' | 'sms' | 'whatsapp';
      message?: string;
    }) => {
      const response = await fetch(`${BASE_URL}/api/orders/${orderId}/reminder`, {
        method: 'POST',
        headers: await getAuthenticatedHeaders(),
        body: JSON.stringify({ channel, message }),
      });

      if (!response.ok) {
        throw new Error(
          await readResponseError(response, 'Failed to send reminder')
        );
      }

      return response.json();
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation({
    mutationKey: ['recordPayment'],
    mutationFn: async ({
      orderId,
      amount,
      paymentMethod,
      reference,
      notes,
    }: {
      orderId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      notes?: string;
    }) =>
      runWithTimeout(
        15000,
        'Request timed out. Please check your connection and try again.',
        async (signal) => {
          const response = await fetch(
            `${BASE_URL}/api/orders/${orderId}/record-payment`,
            {
              method: 'POST',
              headers: await getAuthenticatedHeaders(),
              body: JSON.stringify({
                amount,
                payment_method: paymentMethod,
                reference,
                notes,
              }),
              signal,
            }
          );

          if (!response.ok) {
            throw new Error(
              await readResponseError(
                response,
                `Request failed: ${response.status} ${response.statusText}`
              )
            );
          }

          return response.json();
        }
      ),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
    },
  });
}

export function useGenerateDva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['generateDva'],
    mutationFn: async ({ orderId }: { orderId: string }) =>
      runWithTimeout(
        20000,
        'DVA generation timed out. Paystack may be slow — try again.',
        async (signal) => {
          const response = await fetch(
            `${BASE_URL}/api/orders/${orderId}/generate-dva`,
            {
              method: 'POST',
              headers: await getAuthenticatedHeaders(),
              signal,
            }
          );

          if (!response.ok) {
            throw new Error(
              await readResponseError(
                response,
                `Request failed: ${response.status} ${response.statusText}`
              )
            );
          }

          return response.json() as Promise<{
            success: boolean;
            virtualAccount: {
              account_number: string;
              bank_name: string;
              account_name: string;
            };
            existing: boolean;
          }>;
        }
      ),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
