'use client';

import { CheckCircle2, Info, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/currency';

interface ShippingInsuranceOptionProps {
  orderValue: number;
  currency?: string;
  minOrderValue?: number;
  defaultChecked?: boolean;
  onInsuranceChange: (selected: boolean, premium: number) => void;
}

interface InsuranceQuote {
  premium: {
    estimated: number;
    min: number;
    max: number;
  };
  coverage: {
    description: string;
    provider: string;
  };
}

export function ShippingInsuranceOption({
  orderValue,
  currency = 'NGN',
  minOrderValue = 5000,
  defaultChecked = false,
  onInsuranceChange,
}: ShippingInsuranceOptionProps) {
  const [isSelected, setIsSelected] = useState(defaultChecked);
  const [quote, setQuote] = useState<InsuranceQuote | null>(null);
  const [loading, setLoading] = useState(false);

  const shouldShow = orderValue >= minOrderValue;

  // Fetch insurance quote when order value changes
  useEffect(() => {
    if (!shouldShow) return;

    const fetchQuote = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/insurance/quote?order_value=${orderValue}`
        );
        if (response.ok) {
          const data = await response.json();
          setQuote(data);
        }
      } catch (error) {
        console.error('Failed to fetch insurance quote:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuote();
  }, [orderValue, shouldShow]);

  // Notify parent when selection changes
  useEffect(() => {
    if (!shouldShow) {
      onInsuranceChange(false, 0);
      return;
    }
    const premium = isSelected && quote ? quote.premium.estimated : 0;
    onInsuranceChange(isSelected, premium);
  }, [isSelected, quote, onInsuranceChange, shouldShow]);

  // Don't render if below minimum value
  if (!shouldShow) {
    return null;
  }

  const premium = quote?.premium.estimated || 0;

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Checkbox
            id="shipping-insurance"
            checked={isSelected}
            onCheckedChange={(checked) => setIsSelected(checked === true)}
            disabled={loading}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="shipping-insurance"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <Shield className="h-4 w-4 text-green-600" />
              Protect your order
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Shipping insurance covers your order against loss or damage
                    during transit. If anything happens, you can file a claim
                    for a full refund.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            Coverage against loss or damage in transit
          </p>

          {loading ? (
            <div className="mt-2 h-5 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          ) : quote ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                +{formatCurrency(premium, currency === 'NGN' ? 'NG' : 'US')}
              </span>
              {isSelected && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Protected
                </span>
              )}
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground mt-2">
            Powered by MyCover.ai (Sovereign Trust Insurance)
          </p>
        </div>
      </div>
    </div>
  );
}
