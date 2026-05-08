'use client';

import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CustomerOrderDetailsContent } from '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/customer-order-details-content';
import { OrderStateCard } from '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/order-state-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import type { StorefrontOrder } from '@/types/storefront-order';

export default function CustomerOrderDetailsPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orderId = typeof params?.orderId === 'string' ? params.orderId : null;
  const { merchant, loading: merchantLoading, basePath } = useMerchant();
  const {
    customer,
    isAuthenticated,
    isLoading: authLoading,
  } = useCustomerAuth();
  const [order, setOrder] = useState<StorefrontOrder | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);

  const resolvedBasePath = basePath || '';

  useEffect(() => {
    if (!merchantLoading && !authLoading && !isAuthenticated) {
      const redirectPath = orderId
        ? `${resolvedBasePath}/account/orders/${orderId}`
        : `${resolvedBasePath}/account/orders`;
      router.push(
        asRoute(
          `${resolvedBasePath}/account/login?redirect=${encodeURIComponent(
            redirectPath
          )}`
        )
      );
    }
  }, [
    merchantLoading,
    authLoading,
    isAuthenticated,
    orderId,
    resolvedBasePath,
    router,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchOrder = async () => {
      if (!customer || !merchant?.slug || !orderId) {
        // `isLoadingOrder` initialises to `true` so the skeleton renders on
        // first paint. When we bail out (no session yet, missing orderId,
        // etc.) we must flip it off, otherwise the page renders the
        // skeleton forever and the auth-redirect / missing-param UI below
        // never gets a chance to show.
        setIsLoadingOrder(false);
        return;
      }

      setIsLoadingOrder(true);
      setOrderError(null);

      try {
        const response = await fetch(
          `/api/storefront/account/orders/${orderId}?merchantSlug=${encodeURIComponent(merchant.slug)}`,
          {
            signal: controller.signal,
          }
        );
        const data = await response.json();

        if (!response.ok) {
          setOrderError(data.error || 'Unable to load this order');
          setOrder(null);
          return;
        }

        setOrder(data.order);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        setOrderError('Unable to connect. Please try again.');
        setOrder(null);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingOrder(false);
        }
      }
    };

    void fetchOrder();

    return () => {
      controller.abort();
    };
  }, [customer, merchant?.slug, orderId]);

  if (merchantLoading || authLoading) {
    return (
      <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="mb-4 h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <OrderStateCard
        title="Redirecting to sign in"
        message="Please sign in to view this order."
        actionLabel="Go to sign in"
        actionHref={asRoute(
          `${resolvedBasePath}/account/login?redirect=${encodeURIComponent(
            orderId
              ? `${resolvedBasePath}/account/orders/${orderId}`
              : `${resolvedBasePath}/account/orders`
          )}`
        )}
      />
    );
  }

  if (!customer) {
    return (
      <OrderStateCard
        title="Customer account unavailable"
        message="We could not load your customer profile for this storefront."
        actionLabel="Back to account"
        actionHref={asRoute(`${resolvedBasePath}/account`)}
      />
    );
  }

  if (!merchant?.slug) {
    return (
      <OrderStateCard
        title="Store unavailable"
        message="We could not load this storefront right now."
        actionLabel="Back to orders"
        actionHref={asRoute(`${resolvedBasePath}/account/orders`)}
      />
    );
  }

  if (isLoadingOrder) {
    return (
      <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <output aria-label="Loading order" className="sr-only">
              Loading order
            </output>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (!order || orderError) {
    return (
      <OrderStateCard
        title="Order unavailable"
        message={orderError || 'We could not load this order.'}
        actionLabel="Back to orders"
        actionHref={asRoute(`${resolvedBasePath}/account/orders`)}
      />
    );
  }

  return (
    <CustomerOrderDetailsContent
      order={order}
      basePath={resolvedBasePath}
      merchantSlug={merchant.slug}
    />
  );
}
