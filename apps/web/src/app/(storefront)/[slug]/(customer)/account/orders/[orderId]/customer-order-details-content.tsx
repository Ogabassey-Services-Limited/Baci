import {
  ArrowLeft,
  CreditCard,
  Download,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDisplayCurrency } from '@/lib/format-display-currency';
import {
  BACI_GOOGLE_REVIEW_URL,
  canLeaveStorefrontGoogleReview,
  canRequestStorefrontOrderReturn,
  canShowStorefrontRiderContact,
} from '@/lib/post-purchase-actions';
import { asRoute } from '@/lib/routes';
import type { StorefrontOrder } from '@/types/storefront-order';

interface CustomerOrderDetailsContentProps {
  order: StorefrontOrder;
  basePath: string;
  merchantSlug: string;
}

function formatAccountDate(value: string) {
  return new Date(value).toLocaleDateString('en-US');
}

function formatStatusLabel(status: string | null | undefined) {
  if (!status) {
    return 'Unavailable';
  }

  return status
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

export function CustomerOrderDetailsContent({
  order,
  basePath,
  merchantSlug,
}: CustomerOrderDetailsContentProps) {
  const getHref = (path: string) => `${basePath}${path}`;
  const currency = order.currency || 'NGN';
  const documentLabel =
    order.current_document_kind === 'receipt'
      ? 'Download Receipt'
      : 'Download Invoice';
  const documentHref = `/api/storefront/account/orders/${order.id}/${order.current_document_kind}?merchantSlug=${encodeURIComponent(merchantSlug)}`;
  const firstItem = order.items[0];
  const buyAgainHref = firstItem?.product_id
    ? asRoute(getHref(`/products/${firstItem.product_id}`))
    : null;
  const shouldShowRiderContact =
    canShowStorefrontRiderContact(order.shipping_status) &&
    Boolean(order.rider_phone_number);
  const shouldShowReview = canLeaveStorefrontGoogleReview(
    order.shipping_status
  );
  const shouldShowReturn = canRequestStorefrontOrderReturn(
    order.shipping_status
  );
  const returnHref = order.merchant_support_email
    ? `mailto:${order.merchant_support_email}?subject=${encodeURIComponent(
        `Return request for order ${order.order_number}`
      )}`
    : order.merchant_support_phone
      ? `tel:${order.merchant_support_phone}`
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link
              aria-label="Back to orders"
              href={asRoute(getHref('/account/orders'))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {formatAccountDate(order.created_at)}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <div>
                      {item.product_id ? (
                        <Link
                          href={asRoute(
                            getHref(`/products/${item.product_id}`)
                          )}
                          className="font-medium hover:text-primary"
                        >
                          {item.product_name || item.name}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {item.product_name || item.name}
                        </span>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Qty: {item.quantity}
                      </p>
                      {item.variant_name && (
                        <p className="text-sm text-muted-foreground">
                          {item.variant_name}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-medium">
                      {formatDisplayCurrency(item.price, currency)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {order.items.some((item) => item.has_assurance) && (
              <Link
                href={asRoute(getHref(`/account/orders/${order.id}/insurance`))}
                className="flex items-center gap-2 rounded-md border p-4 text-sm font-medium hover:bg-muted/40"
              >
                <ShieldCheck className="h-5 w-5 text-green-600" />
                View Insurance Policy
              </Link>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Delivery & Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex gap-3">
                  <Truck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {formatStatusLabel(order.shipping_status)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.shipping_provider ||
                        'Shipping updates will appear here'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {formatStatusLabel(order.payment_status)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.payment_method || 'Payment method unavailable'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {formatDisplayCurrency(order.subtotal || 0, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {formatDisplayCurrency(order.shipping_fee || 0, currency)}
                  </span>
                </div>
                {typeof order.tax_amount === 'number' &&
                order.tax_amount > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>
                      {formatDisplayCurrency(order.tax_amount, currency)}
                    </span>
                  </div>
                ) : null}
                {typeof order.discount_amount === 'number' &&
                order.discount_amount > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span>
                      -{formatDisplayCurrency(order.discount_amount, currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{formatDisplayCurrency(order.total, currency)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <a href={documentHref}>
                  <Download className="mr-2 h-4 w-4" />
                  {documentLabel}
                </a>
              </Button>
              {shouldShowRiderContact ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={`tel:${order.rider_phone_number}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call Rider {order.rider_phone_number}
                  </a>
                </Button>
              ) : null}
              {shouldShowReview ? (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={BACI_GOOGLE_REVIEW_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Star className="mr-2 h-4 w-4" />
                    Leave a Google Review
                  </a>
                </Button>
              ) : null}
              {shouldShowReturn && returnHref ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={returnHref}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Return Order
                  </a>
                </Button>
              ) : null}
              {buyAgainHref ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={buyAgainHref}>
                    <Package className="mr-2 h-4 w-4" />
                    Buy Again
                  </Link>
                </Button>
              ) : null}
              {order.current_document_kind === 'invoice' ? (
                <p className="text-xs text-muted-foreground">
                  Receipts become available after the order has been shipped and
                  the payment is fully settled.
                </p>
              ) : null}
            </div>

            {order.transactions && order.transactions.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {order.transactions.map((transaction, index) => (
                    <div
                      key={
                        transaction.id || `${transaction.created_at}-${index}`
                      }
                      className="flex justify-between gap-4"
                    >
                      <div>
                        <p className="font-medium">
                          {transaction.metadata?.payment_method ||
                            transaction.description ||
                            'Payment'}
                        </p>
                        <p className="text-muted-foreground">
                          {formatAccountDate(transaction.created_at)}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatDisplayCurrency(transaction.amount, currency)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
