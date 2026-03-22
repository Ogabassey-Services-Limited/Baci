'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import type { StorefrontOrder } from '@/types/storefront-order';
import { CustomerOrderDetailsContent } from './customer-order-details-content';

function OrderStateCard(props: {
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card className="border-destructive/50">
          <CardContent className="p-10 text-center">
            <AlertCircle className="mx-auto mb-4 h-14 w-14 text-destructive/60" />
            <h1 className="mb-2 text-xl font-semibold">{props.title}</h1>
            <p className="mb-6 text-muted-foreground">{props.message}</p>
            <Button asChild variant="outline">
              <Link href={props.actionHref}>{props.actionLabel}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
      if (!customer || !merchant?.slug || !orderId) return;

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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
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

  if (!merchant || !merchant.slug) {
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Card className="border-destructive/50">
            <CardContent className="p-10 text-center">
              <AlertCircle className="mx-auto mb-4 h-14 w-14 text-destructive/60" />
              <h1 className="mb-2 text-xl font-semibold">Order unavailable</h1>
              <p className="mb-6 text-muted-foreground">
                {orderError || 'We could not load this order.'}
              </p>
              <Button asChild variant="outline">
                <Link href={asRoute(`${resolvedBasePath}/account/orders`)}>
                  Back to orders
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
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
