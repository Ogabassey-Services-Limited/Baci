'use client';

import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OgabasseyV2PurchaseHistory } from '@/components/storefront/ogabassey/pages/purchase-history';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  has_assurance?: boolean;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  shipping_status:
    | 'pending'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
  items: OrderItem[];
  shipping_address?: {
    address: string;
    city: string;
    state: string;
  };
  tracking_number?: string;
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const { merchant, loading: merchantLoading, basePath } = useMerchant();
  const {
    customer,
    isAuthenticated,
    isLoading: authLoading,
  } = useCustomerAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const resolvedBasePath = basePath || '';
  const getHref = (path: string) => `${resolvedBasePath}${path}`;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!merchantLoading && !authLoading && !isAuthenticated) {
      router.push(
        asRoute(
          `${resolvedBasePath}/account/login?redirect=${encodeURIComponent(
            `${resolvedBasePath}/account/orders`
          )}`
        )
      );
    }
  }, [merchantLoading, authLoading, isAuthenticated, router, resolvedBasePath]);

  // Fetch orders
  const fetchOrders = async () => {
    if (!customer || !merchant?.slug) return;

    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const response = await fetch(
        `/api/storefront/orders?merchantSlug=${encodeURIComponent(merchant.slug)}`
      );
      const data = await response.json();

      if (response.ok) {
        setOrders(data.orders || []);
      } else {
        const errorMsg =
          data.error || `Failed to load orders (${response.status})`;
        console.error('Failed to fetch orders:', errorMsg);
        setOrdersError(errorMsg);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrdersError(
        'Unable to connect. Please check your internet connection.'
      );
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    if (customer && merchant) {
      fetchOrders();
    }
  }, [customer, merchant]);

  if (merchantLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div
          className="container mx-auto max-w-4xl px-4 py-8"
          aria-live="polite"
        >
          <span className="sr-only">Loading orders</span>
          <Skeleton className="h-8 w-48 mb-8" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 mb-4" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customer) {
    return null;
  }

  if (!merchant) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Card className="border-destructive/50">
            <CardContent className="p-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive/50" />
              <h3 className="mb-2 text-lg font-semibold">Store unavailable</h3>
              <p className="mb-6 text-muted-foreground">
                We could not load this storefront right now.
              </p>
              <Button asChild variant="outline">
                <Link href={asRoute(getHref('/account'))}>
                  Go to account home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link
            href={asRoute(getHref('/account'))}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to account</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Your Orders</h1>
          <p className="text-muted-foreground">
            View and track all your orders
          </p>
        </div>

        {isLoadingOrders ? (
          <div
            className="flex items-center justify-center py-12"
            aria-live="polite"
          >
            <span className="sr-only">Loading orders</span>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : ordersError ? (
          <Card className="border-destructive/50">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive/50" />
              <h3 className="text-lg font-semibold mb-2">
                Unable to load orders
              </h3>
              <p className="text-muted-foreground mb-6">{ordersError}</p>
              <Button onClick={() => fetchOrders()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <OgabasseyV2PurchaseHistory
            orders={orders}
            onViewDetails={(orderId) =>
              router.push(asRoute(getHref(`/account/orders/${orderId}`)))
            }
            onBuyAgain={(productName) => console.log('Buy again:', productName)} // Placeholder
          />
        )}
      </main>
    </div>
  );
}
