import type { Dispatch, SetStateAction } from 'react';
import type { StorefrontOrder } from '@/types/storefront-order';

interface LoadArchiveOrdersInput {
  merchantSlug: string;
  setOrders: Dispatch<SetStateAction<StorefrontOrder[]>>;
  setIsLoadingOrders: Dispatch<SetStateAction<boolean>>;
  setOrdersError: Dispatch<SetStateAction<string | null>>;
  signal?: AbortSignal;
}

export async function loadArchiveOrders({
  merchantSlug,
  setOrders,
  setIsLoadingOrders,
  setOrdersError,
  signal,
}: LoadArchiveOrdersInput) {
  if (signal?.aborted) {
    return;
  }

  setIsLoadingOrders(true);
  setOrdersError(null);

  try {
    const response = await fetch(
      `/api/storefront/orders?merchantSlug=${encodeURIComponent(merchantSlug)}`,
      signal ? { signal } : undefined
    );

    if (signal?.aborted) {
      return;
    }

    const data = await response.json();

    if (signal?.aborted) {
      return;
    }

    if (!response.ok) {
      setOrdersError(data.error || 'Unable to load documents');
      setOrders([]);
      return;
    }

    setOrders(data.orders || []);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    if (signal?.aborted) {
      return;
    }

    setOrdersError('Unable to connect. Please try again.');
    setOrders([]);
  } finally {
    if (!signal?.aborted) {
      setIsLoadingOrders(false);
    }
  }
}
