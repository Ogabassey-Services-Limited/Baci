'use client';

import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchant } from '@/hooks/use-merchant';
import { formatDisplayCurrency } from '@/lib/format-display-currency';
import { asRoute } from '@/lib/routes';
import { normalizeShippingStatus } from '@/lib/storefront-account-document-data';
import type { StorefrontOrder } from '@/types/storefront-order';

const ARCHIVE_STATUSES = new Set(['shipped', 'delivered']);
const ARCHIVE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatArchiveDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return ARCHIVE_DATE_FORMATTER.format(date);
}

async function loadArchiveOrders(input: {
  merchantSlug: string;
  setOrders: Dispatch<SetStateAction<StorefrontOrder[]>>;
  setIsLoadingOrders: Dispatch<SetStateAction<boolean>>;
  setOrdersError: Dispatch<SetStateAction<string | null>>;
}) {
  const { merchantSlug, setOrders, setIsLoadingOrders, setOrdersError } = input;

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

export default function ReceiptsPage() {
  const router = useRouter();
  const { merchant, loading: merchantLoading, basePath } = useMerchant();
  const {
    customer,
    isAuthenticated,
    isLoading: authLoading,
  } = useCustomerAuth();
  const [orders, setOrders] = useState<StorefrontOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const resolvedBasePath = basePath || '';
  const getHref = (path: string) => `${resolvedBasePath}${path}`;
  const customerId = customer?.id;
  const merchantSlug = merchant?.slug;

  useEffect(() => {
    if (!merchantLoading && !authLoading && !isAuthenticated) {
      router.push(
        asRoute(
          `${resolvedBasePath}/account/login?redirect=${encodeURIComponent(
            `${resolvedBasePath}/receipts`
          )}`
        )
      );
    }
  }, [merchantLoading, authLoading, isAuthenticated, router, resolvedBasePath]);

  useEffect(() => {
    if (!customerId || !merchantSlug) return;

    void loadArchiveOrders({
      merchantSlug,
      setOrders,
      setIsLoadingOrders,
      setOrdersError,
    });
  }, [customerId, merchantSlug]);

  const archiveOrders = orders.filter((order) =>
    ARCHIVE_STATUSES.has(normalizeShippingStatus(order.shipping_status))
  );

  const query = searchQuery.trim().toLowerCase();
  const filteredOrders = query
    ? archiveOrders.filter((order) => {
        const matchesOrder = order.order_number.toLowerCase().includes(query);
        const matchesItems = order.items.some((item) =>
          (item.product_name || item.name).toLowerCase().includes(query)
        );
        const matchesType = (order.current_document_kind || 'invoice')
          .toLowerCase()
          .includes(query);

        return matchesOrder || matchesItems || matchesType;
      })
    : archiveOrders;

  if (merchantLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <Skeleton className="mb-4 h-8 w-56" />
          <Skeleton className="mb-4 h-11 w-full" />
          <Skeleton className="h-44" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !customer || !merchant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link href={asRoute(getHref('/account'))}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Receipts & Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Shipped orders appear here once documents are available.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by order number, product, or document type"
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoadingOrders ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : ordersError ? (
          <Card className="border-destructive/50">
            <CardContent className="p-10 text-center">
              <AlertCircle className="mx-auto mb-4 h-14 w-14 text-destructive/60" />
              <h2 className="mb-2 text-lg font-semibold">
                Unable to load documents
              </h2>
              <p className="mb-6 text-muted-foreground">{ordersError}</p>
              <Button
                onClick={() => {
                  if (!customerId || !merchantSlug) return;

                  void loadArchiveOrders({
                    merchantSlug,
                    setOrders,
                    setIsLoadingOrders,
                    setOrdersError,
                  });
                }}
                variant="outline"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ReceiptText className="mx-auto mb-4 h-14 w-14 text-muted-foreground/60" />
              <h2 className="mb-2 text-lg font-semibold">No documents yet</h2>
              <p className="text-muted-foreground">
                Orders appear here after they have been shipped or delivered.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const documentKind = order.current_document_kind || 'invoice';
              const downloadHref = `/api/storefront/account/orders/${order.id}/${documentKind}?merchantSlug=${encodeURIComponent(merchant?.slug || '')}`;

              return (
                <Card key={order.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="text-lg">
                        #{order.order_number}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatArchiveDate(order.created_at)} •{' '}
                        {order.items[0]?.product_name ||
                          order.items[0]?.name ||
                          'Order'}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium capitalize">
                      <FileText className="h-3.5 w-3.5" />
                      {documentKind}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Total:{' '}
                        {formatDisplayCurrency(
                          order.total,
                          order.currency || 'NGN'
                        )}
                      </p>
                      <p className="capitalize">
                        Status: {order.shipping_status}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button asChild variant="outline">
                        <Link
                          href={asRoute(getHref(`/account/orders/${order.id}`))}
                        >
                          View Order
                        </Link>
                      </Button>
                      <Button asChild>
                        <a href={downloadHref}>
                          <Download className="mr-2 h-4 w-4" />
                          Download{' '}
                          {documentKind === 'receipt' ? 'Receipt' : 'Invoice'}
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
