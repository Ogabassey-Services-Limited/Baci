'use client';

import { Tag } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCart } from '@/hooks/use-cart';
import { useCurrency } from '@/hooks/use-currency';

interface OrderSummaryProps {
  shippingFee?: number;
  discountAmount?: number;
  discountCode?: string;
}

export function OrderSummary({
  shippingFee,
  discountAmount = 0,
  discountCode,
}: OrderSummaryProps) {
  const { cart, cartTotal } = useCart();
  const { formatCurrency } = useCurrency();

  const total = cartTotal + (shippingFee || 0) - discountAmount;

  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
          {cart.map((item) => (
            <div key={item.id} className="flex items-center gap-4">
              <Image
                src={item.image}
                alt={item.name}
                width={64}
                height={64}
                className="rounded-md object-cover"
              />
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  Qty: {item.quantity}
                </p>
              </div>
              <p className="font-medium">
                {formatCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(cartTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Shipping</span>
            {shippingFee !== undefined ? (
              shippingFee === 0 ? (
                <span className="text-green-600 font-medium">FREE</span>
              ) : (
                <span>{formatCurrency(shippingFee)}</span>
              )
            ) : (
              <span className="text-muted-foreground text-sm">
                Select shipping option
              </span>
            )}
          </div>
          {discountAmount > 0 && discountCode && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                <Tag className="size-3" />
                Discount ({discountCode})
              </span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
