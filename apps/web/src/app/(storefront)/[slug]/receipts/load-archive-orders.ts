import type { Dispatch, SetStateAction } from 'react';
import type { StorefrontOrder } from '@/types/storefront-order';

interface LoadArchiveOrdersInput {
  merchantSlug: string;
  setOrders: Dispatch<SetStateAction<StorefrontOrder[]>>;
  setIsLoadingOrders: Dispatch<SetStateAction<boolean>>;
  setOrdersError: Dispatch<SetStateAction<string | null>>;
}

export async function loadArchiveOrders({
  merchantSlug,
  setOrders,
  setIsLoadingOrders,
  setOrdersError,
}: LoadArchiveOrdersInput) {
  setIsLoadingOrders(true);
  setOrdersError(null);

  try {
    const response = await fetch(
      `/api/storefront/orders?merchantSlug=${encodeURIComponent(merchantSlug)}`
    );
    const data = await response.json();

    if (!response.ok) {
      setOrdersError(data.error || 'Unable to load documents');
      setOrders([]);
      return;
    }

    setOrders(data.orders || []);
  } catch {
    setOrdersError('Unable to connect. Please try again.');
    setOrders([]);
  } finally {
    setIsLoadingOrders(false);
  }
}
