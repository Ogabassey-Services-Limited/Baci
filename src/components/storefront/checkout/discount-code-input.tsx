'use client';

/**
 * Discount Code Input Component
 *
 * 2025 Best Practices Applied:
 * - Strategic placement near order summary (not front-loaded)
 * - Collapsible by default to avoid "code hunting" abandonment
 * - Clear success/error states
 * - Shows discount value immediately
 * - Easy removal of applied discount
 */

import { useState, useCallback } from 'react';
import { Tag, X, Check, Loader2, ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrency } from '@/hooks/use-currency';
import type { DiscountCodeInputProps, DiscountResult } from './types';

/**
 * Applied Discount Display
 */
function AppliedDiscount({
  discount,
  onRemove,
  formatCurrency,
  disabled,
}: {
  discount: DiscountResult;
  onRemove: () => void;
  formatCurrency: (amount: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-green-100 rounded-full">
          <Check className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-green-800">{discount.code}</span>
            <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
              {discount.discountType === 'percentage'
                ? `${discount.discountValue}% off`
                : `${formatCurrency(discount.discountValue)} off`}
            </span>
          </div>
          {discount.description && (
            <p className="text-xs text-green-700 mt-0.5">{discount.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-bold text-green-700">
          -{formatCurrency(discount.discountAmount)}
        </span>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="p-1 hover:bg-green-200 rounded-full transition-colors disabled:opacity-50"
          aria-label="Remove discount"
        >
          <X className="h-4 w-4 text-green-700" />
        </button>
      </div>
    </div>
  );
}

/**
 * Main Discount Code Input Component
 */
export function DiscountCodeInput({
  merchantId,
  orderTotal,
  productIds = [],
  categoryIds = [],
  customerEmail,
  onApply,
  className,
  disabled,
}: DiscountCodeInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const { formatCurrency } = useCurrency();

  // Validate and apply discount code
  const handleApply = useCallback(async () => {
    if (!code.trim()) {
      setError('Please enter a discount code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          merchantId,
          customerEmail,
          orderTotal,
          productIds,
          categoryIds,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setError(data.error || 'Invalid discount code');
        return;
      }

      // Build discount result
      const discountResult: DiscountResult = {
        id: data.discountCode.id,
        code: data.discountCode.code,
        description: data.discountCode.description,
        discountType: data.discountCode.discount_type,
        discountValue: data.discountCode.discount_value,
        discountAmount: data.discountAmount,
        finalTotal: data.finalTotal,
      };

      setAppliedDiscount(discountResult);
      onApply(discountResult);
      setCode(''); // Clear input after successful apply
    } catch (err) {
      console.error('Error validating discount code:', err);
      setError('Unable to validate code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code, merchantId, customerEmail, orderTotal, productIds, categoryIds, onApply]);

  // Remove applied discount
  const handleRemove = useCallback(() => {
    setAppliedDiscount(null);
    onApply(null);
    setIsExpanded(false);
  }, [onApply]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  // If discount is applied, show the applied state
  if (appliedDiscount) {
    return (
      <div className={className}>
        <AppliedDiscount
          discount={appliedDiscount}
          onRemove={handleRemove}
          formatCurrency={formatCurrency}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Collapsible Toggle - 2025 Best Practice: Don't front-load promo codes */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-3 text-sm border rounded-lg hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Have a discount code?</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Expandable Input Section */}
      {isExpanded && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                disabled={loading || disabled}
                className={cn(
                  'pl-10 uppercase',
                  error && 'border-destructive focus-visible:ring-destructive'
                )}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </div>
            <Button
              type="button"
              onClick={handleApply}
              disabled={loading || disabled || !code.trim()}
              variant="outline"
              className="shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Apply'
              )}
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default DiscountCodeInput;
