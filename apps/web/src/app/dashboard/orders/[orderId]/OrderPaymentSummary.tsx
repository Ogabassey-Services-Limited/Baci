import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDisplayCurrency } from '@/lib/format-display-currency';
import type { Order } from '../actions';

interface OrderPaymentSummaryProps {
  order: Pick<
    Order,
    | 'currency'
    | 'discount_amount'
    | 'paymentMethod'
    | 'payment_reference'
    | 'shipping_fee'
    | 'subtotal'
    | 'tax_amount'
    | 'total'
  >;
}

function formatCurrency(amount: number, currency?: string | null): string {
  return formatDisplayCurrency(amount, currency || 'NGN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function normalizeAmount(amount: number | undefined, fallback = 0) {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? Math.max(0, amount)
    : fallback;
}

export function OrderPaymentSummary({ order }: OrderPaymentSummaryProps) {
  const orderCurrency = order.currency || 'NGN';
  const shippingFee = normalizeAmount(order.shipping_fee);
  const taxes = normalizeAmount(order.tax_amount);
  const discountAmount = normalizeAmount(order.discount_amount);
  const subtotal = normalizeAmount(
    order.subtotal,
    Math.max(0, order.total - shippingFee - taxes + discountAmount)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Payment Summary</CardTitle>
        <Button variant="outline" size="sm" className="gap-1">
          <Download className="size-3.5" />
          Download Receipt
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <span>Subtotal</span>{' '}
          <span>{formatCurrency(subtotal, orderCurrency)}</span>
        </div>
        {order.paymentMethod && (
          <div className="flex justify-between">
            <span>Payment Method</span>{' '}
            <span className="capitalize">{order.paymentMethod}</span>
          </div>
        )}
        {order.payment_reference && (
          <div className="flex justify-between">
            <span>Payment Reference</span>{' '}
            <span className="font-mono text-xs">{order.payment_reference}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Shipping Fee</span>{' '}
          <span>{formatCurrency(shippingFee, orderCurrency)}</span>
        </div>
        <div className="flex justify-between">
          <span>Taxes</span> <span>{formatCurrency(taxes, orderCurrency)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Discount</span>{' '}
            <span>-{formatCurrency(discountAmount, orderCurrency)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total Amount</span>{' '}
          <span>{formatCurrency(order.total, orderCurrency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
