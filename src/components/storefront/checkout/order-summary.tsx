'use client';

import { ChevronDown, ChevronUp, Shield, Sparkles, Tag } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/hooks/use-currency';
import { DiscountCodeInput } from './discount-code-input';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image?: string;
}

interface DiscountResult {
  valid: boolean;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order?: number;
  description?: string;
  error?: string;
}

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discount?: DiscountResult | null;
  merchantId: string;
  loyaltyPointsEarned?: number;
  showDiscountInput?: boolean;
  onDiscountApply?: (discount: DiscountResult) => void;
  onDiscountRemove?: () => void;
  collapsible?: boolean;
}

export function OrderSummary({
  items,
  subtotal,
  shippingCost,
  discount,
  merchantId,
  loyaltyPointsEarned,
  showDiscountInput = true,
  onDiscountApply,
  onDiscountRemove,
  collapsible = false,
}: OrderSummaryProps) {
  const [isOpen, setIsOpen] = useState(!collapsible);

  const calculateDiscountAmount = (): number => {
    if (!discount) return 0;
    if (discount.discount_type === 'percentage') {
      return Math.round(subtotal * (discount.discount_value / 100));
    }
    return Math.min(discount.discount_value, subtotal);
  };

  const discountAmount = calculateDiscountAmount();
  const total = subtotal + shippingCost - discountAmount;

  const { formatCurrency } = useCurrency();

  const SummaryContent = () => (
    <>
      {/* Items */}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            {item.product_image && (
              <div className="relative w-16 h-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                <Image
                  src={item.product_image}
                  alt={item.product_name}
                  fill
                  className="object-cover"
                />
                <Badge
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  variant="secondary"
                >
                  {item.quantity}
                </Badge>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {item.product_name}
              </p>
              {item.variant_name && (
                <p className="text-xs text-muted-foreground">
                  {item.variant_name}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {formatCurrency(item.unit_price)} × {item.quantity}
              </p>
            </div>
            <div className="text-sm font-medium">
              {formatCurrency(item.total_price)}
            </div>
          </div>
        ))}
      </div>

      {/* Discount Code Input */}
      {showDiscountInput && onDiscountApply && onDiscountRemove && (
        <>
          <Separator className="my-4" />
          <DiscountCodeInput
            merchantId={merchantId}
            cartTotal={subtotal}
            onApply={onDiscountApply}
            onRemove={onDiscountRemove}
            appliedDiscount={discount}
          />
        </>
      )}

      {/* Totals */}
      <Separator className="my-4" />
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span>
            {shippingCost === 0 ? (
              <span className="text-green-600">FREE</span>
            ) : (
              formatCurrency(shippingCost)
            )}
          </span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-green-600">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Discount ({discount?.code})
            </span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        <Separator className="my-2" />

        <div className="flex justify-between text-base font-medium">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Loyalty Points Indicator */}
      {loyaltyPointsEarned && loyaltyPointsEarned > 0 && (
        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="text-sm text-purple-800">
              Earn <strong>{loyaltyPointsEarned}</strong> points with this
              purchase
            </span>
          </div>
        </div>
      )}

      {/* Trust Badges */}
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Secure checkout powered by Korapay</span>
        </div>
      </div>
    </>
  );

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                  <Badge variant="secondary">{items.length} items</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(total)}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <SummaryContent />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Order Summary</span>
          <Badge variant="secondary">{items.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SummaryContent />
      </CardContent>
    </Card>
  );
}
