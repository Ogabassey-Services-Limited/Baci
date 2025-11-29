'use client';

/**
 * Dynamic Order Summary Component
 *
 * 2025 Best Practices Applied:
 * - Real-time price updates when shipping/discount changes
 * - No hidden fees - all costs visible upfront
 * - Clear breakdown of all charges
 * - Mobile-optimized sticky summary
 * - Visual loading states during calculations
 */

import { useMemo } from 'react';
import { ShoppingBag, Truck, Tag, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/hooks/use-currency';
import { useCart } from '@/hooks/use-cart';
import type { DynamicOrderSummaryProps } from './types';

/**
 * Line Item Row Component
 */
function SummaryRow({
  label,
  value,
  icon: Icon,
  isLoading,
  highlight,
  negative,
  className,
}: {
  label: string;
  value: string | number;
  icon?: typeof Truck;
  isLoading?: boolean;
  highlight?: boolean;
  negative?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2',
        highlight && 'font-semibold',
        className
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className={cn(negative && 'text-green-600')}>{label}</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-5 w-16" />
      ) : (
        <span
          className={cn(
            'font-medium',
            negative && 'text-green-600',
            highlight && 'text-lg'
          )}
        >
          {negative && typeof value === 'string' ? `-${value}` : value}
        </span>
      )}
    </div>
  );
}

/**
 * Cart Item Preview
 */
function CartItemPreview({
  item,
  formatCurrency,
}: {
  item: { name: string; quantity: number; price: number; image?: string };
  formatCurrency: (amount: number) => string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Item Image */}
      <div className="w-12 h-12 bg-muted rounded-md overflow-hidden shrink-0">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Item Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
      </div>

      {/* Item Total */}
      <span className="text-sm font-medium shrink-0">
        {formatCurrency(item.price * item.quantity)}
      </span>
    </div>
  );
}

/**
 * Main Dynamic Order Summary Component
 */
export function DynamicOrderSummary({
  subtotal,
  shippingQuote,
  discount,
  currencyCode: _currencyCode,
  shippingLoading,
  className,
}: DynamicOrderSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { cart, cartCount } = useCart();

  // Calculate totals
  const calculations = useMemo(() => {
    const shippingFee = shippingQuote?.price || 0;
    const discountAmount = discount?.discountAmount || 0;
    const total = Math.max(0, subtotal + shippingFee - discountAmount);

    return {
      subtotal,
      shippingFee,
      discountAmount,
      total,
    };
  }, [subtotal, shippingQuote, discount]);

  // Delivery info
  const deliveryInfo = shippingQuote
    ? `${shippingQuote.carrierName || shippingQuote.displayName} (${shippingQuote.estimatedDays || '3-5'} days)`
    : null;

  return (
    <Card className={cn('sticky top-4', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Order Summary
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            {cartCount} item{cartCount !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cart Items Preview - Collapsible on mobile */}
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {cart.map((item) => (
            <CartItemPreview
              key={item.id}
              item={item}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>

        <Separator />

        {/* Price Breakdown */}
        <div className="space-y-1">
          {/* Subtotal */}
          <SummaryRow
            label="Subtotal"
            value={formatCurrency(calculations.subtotal)}
          />

          {/* Shipping */}
          <SummaryRow
            label={deliveryInfo || 'Shipping'}
            value={
              calculations.shippingFee > 0
                ? formatCurrency(calculations.shippingFee)
                : 'Free'
            }
            icon={Truck}
            isLoading={shippingLoading}
          />

          {/* Discount (if applied) */}
          {discount && calculations.discountAmount > 0 && (
            <SummaryRow
              label={`Discount (${discount.code})`}
              value={formatCurrency(calculations.discountAmount)}
              icon={Tag}
              negative
            />
          )}
        </div>

        <Separator />

        {/* Total */}
        <SummaryRow
          label="Total"
          value={formatCurrency(calculations.total)}
          highlight
          className="py-3"
        />

        {/* Shipping Info Note */}
        {shippingQuote && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p>
                Estimated delivery:{' '}
                <span className="font-medium text-foreground">
                  {shippingQuote.estimatedDays
                    ? `${shippingQuote.estimatedDays} business days`
                    : '3-5 business days'}
                </span>
              </p>
              {shippingQuote.isStationPickup && (
                <p className="mt-1 text-amber-600">
                  Pickup at: {shippingQuote.stationName}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            🔒 Secure checkout
          </span>
          <span className="flex items-center gap-1">
            📦 Tracked shipping
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact Order Summary (for mobile bottom bar)
 */
export function CompactOrderSummary({
  total,
  itemCount,
  isLoading,
  className,
}: {
  total: number;
  itemCount: number;
  isLoading?: boolean;
  className?: string;
}) {
  const { formatCurrency } = useCurrency();

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 bg-background border-t',
        className
      )}
    >
      <div>
        <p className="text-sm text-muted-foreground">
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </p>
        {isLoading ? (
          <Skeleton className="h-6 w-24 mt-1" />
        ) : (
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
        )}
      </div>
      {/* Button slot - parent provides the button */}
    </div>
  );
}

export default DynamicOrderSummary;
