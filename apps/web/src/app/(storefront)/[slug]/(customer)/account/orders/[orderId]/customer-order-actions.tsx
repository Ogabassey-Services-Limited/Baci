import { Download, Package, Phone, RotateCcw, Star } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { CancelOrderDialog } from '@/app/(storefront)/[slug]/(customer)/account/orders/[orderId]/cancel-order-dialog';
import { Button } from '@/components/ui/button';
import {
  BACI_GOOGLE_REVIEW_URL,
  canLeaveStorefrontGoogleReview,
  canRequestStorefrontOrderReturn,
  canShowStorefrontRiderContact,
} from '@/lib/post-purchase-actions';
import type { StorefrontOrder } from '@/types/storefront-order';

interface CustomerOrderActionsProps {
  order: StorefrontOrder;
  documentLabel: string;
  documentHref: string;
  buyAgainHref: Route | null;
  /** Re-fetch the order view after a cancellation so the CTAs stay in sync. */
  onOrderChanged?: () => void;
}

export function CustomerOrderActions({
  order,
  documentLabel,
  documentHref,
  buyAgainHref,
  onOrderChanged,
}: CustomerOrderActionsProps) {
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
    <div className="space-y-3">
      <Button asChild className="w-full">
        <a href={documentHref}>
          <Download className="mr-2 size-4" />
          {documentLabel}
        </a>
      </Button>
      {shouldShowRiderContact ? (
        <Button asChild variant="outline" className="w-full">
          <a href={`tel:${order.rider_phone_number}`}>
            <Phone className="mr-2 size-4" />
            Call Rider {order.rider_phone_number}
          </a>
        </Button>
      ) : null}
      {shouldShowReview ? (
        <Button asChild variant="outline" className="w-full">
          <a href={BACI_GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer">
            <Star className="mr-2 size-4" />
            Leave a Google Review
          </a>
        </Button>
      ) : null}
      {shouldShowReturn && returnHref ? (
        <Button asChild variant="outline" className="w-full">
          <a href={returnHref}>
            <RotateCcw className="mr-2 size-4" />
            Return Order
          </a>
        </Button>
      ) : null}
      {buyAgainHref ? (
        <Button asChild variant="outline" className="w-full">
          <Link href={buyAgainHref}>
            <Package className="mr-2 size-4" />
            Buy Again
          </Link>
        </Button>
      ) : null}
      {order.can_cancel ? (
        <CancelOrderDialog orderId={order.id} onCancelled={onOrderChanged} />
      ) : null}
      {order.current_document_kind === 'invoice' ? (
        <p className="text-xs text-muted-foreground">
          Receipts become available after the order has been shipped and the
          payment is fully settled.
        </p>
      ) : null}
    </div>
  );
}
