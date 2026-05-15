import type { Order, ShippingStatus } from '@baci/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';
import type { OrdersPage } from './order-types';
import { parseResponsePayload } from './response-utils';

const ORDER_STATUS_UPDATE_TIMEOUT_MS = 15000;

interface OrderStatusContext {
  previousOrderQueries: [readonly unknown[], Order | undefined][];
  previousOrders: [readonly unknown[], InfiniteData<OrdersPage> | undefined][];
}

interface OrderStatusVariables {
  orderId: string;
  status: ShippingStatus;
}

async function updateOrderStatus(
  orderId: string,
  status: ShippingStatus,
  merchantId: string
): Promise<Order> {
  const response = await createAuthenticatedFetch(
    `${BASE_URL}/api/orders/${orderId}`,
    {
      body: JSON.stringify({
        merchant_id: merchantId,
        shipping_status: status,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
    ORDER_STATUS_UPDATE_TIMEOUT_MS
  );
  const responseText = await response.text();
  const payload = parseResponsePayload(responseText);

  if (!response.ok) {
    const errorMessage =
      payload &&
      typeof payload === 'object' &&
      typeof payload.error === 'string'
        ? payload.error
        : responseText ||
          `Request failed: ${response.status} ${response.statusText}`;
    throw new Error(errorMessage);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('order' in payload) ||
    !payload.order
  ) {
    throw new Error('Failed to update order status');
  }

  return payload.order as Order;
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation<Order, Error, OrderStatusVariables, OrderStatusContext>({
    mutationFn: ({ orderId, status }) => {
      if (!merchant?.id) {
        throw new Error('Merchant ID is required');
      }

      return updateOrderStatus(orderId, status, merchant.id);
    },
    mutationKey: ['updateOrderStatus'],
    onError: (_err, _vars, context) => {
      context?.previousOrders?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousOrderQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onMutate: async ({ orderId, status }) => {
      if (!merchant?.id) {
        return { previousOrderQueries: [], previousOrders: [] };
      }

      await queryClient.cancelQueries({ queryKey: ['orders', merchant.id] });
      await queryClient.cancelQueries({ queryKey: ['order', orderId] });

      const previousOrders = queryClient.getQueriesData<
        InfiniteData<OrdersPage>
      >({
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

      const previousOrderQueries = queryClient.getQueriesData<Order>({
        queryKey: ['order', orderId],
      });

      queryClient.setQueriesData<Order>(
        { queryKey: ['order', orderId] },
        (old) => {
          if (!old) {
            return old;
          }

          return { ...old, shipping_status: status };
        }
      );

      return { previousOrderQueries, previousOrders };
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({ queryKey: ['order', vars.orderId] });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
    },
  });
}
