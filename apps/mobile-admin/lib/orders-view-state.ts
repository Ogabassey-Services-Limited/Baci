interface OrdersViewStateInput {
  hasMerchant: boolean;
  isMerchantLoading: boolean;
  merchantError: Error | null;
  isOrdersLoading: boolean;
  ordersError: Error | null;
  ordersLength: number;
}

export type OrdersViewState =
  | {
      status: 'loading' | 'ready' | 'empty';
      title?: never;
      message?: never;
    }
  | {
      status: 'error';
      title: string;
      message: string;
    };

export function getOrdersViewState({
  hasMerchant,
  isMerchantLoading,
  merchantError,
  isOrdersLoading,
  ordersError,
  ordersLength,
}: OrdersViewStateInput): OrdersViewState {
  if (ordersLength > 0) {
    return { status: 'ready' };
  }

  if (isMerchantLoading || isOrdersLoading) {
    return { status: 'loading' };
  }

  if (merchantError) {
    return {
      status: 'error',
      title: 'Failed to load store',
      message:
        'We could not load your store context for this account. Try again or sign in again if the issue persists.',
    };
  }

  if (!hasMerchant) {
    return {
      status: 'error',
      title: 'Store unavailable',
      message:
        'No merchant account is linked to this session right now. Refresh the screen or sign in again.',
    };
  }

  if (ordersError) {
    return {
      status: 'error',
      title: 'Failed to load orders',
      message:
        'We could not load your orders right now. Pull to refresh or try again.',
    };
  }

  return { status: 'empty' };
}
