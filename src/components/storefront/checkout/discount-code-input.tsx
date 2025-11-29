'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tag, X, Check, Loader2 } from 'lucide-react';

interface DiscountResult {
  valid: boolean;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order?: number;
  description?: string;
  error?: string;
}

interface DiscountCodeInputProps {
  merchantId: string;
  cartTotal: number;
  onApply: (discount: DiscountResult) => void;
  onRemove: () => void;
  appliedDiscount?: DiscountResult | null;
}

export function DiscountCodeInput({
  merchantId,
  cartTotal,
  onApply,
  onRemove,
  appliedDiscount,
}: DiscountCodeInputProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!code.trim()) {
      setError('Please enter a discount code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/storefront/discount/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          code: code.trim().toUpperCase(),
          cart_total: cartTotal,
        }),
      });

      const result: DiscountResult = await response.json();

      if (!response.ok || !result.valid) {
        setError(result.error || 'Invalid discount code');
        toast({
          title: 'Invalid Code',
          description: result.error || 'This discount code is not valid',
          variant: 'destructive',
        });
        return;
      }

      onApply(result);
      setCode('');
      toast({
        title: 'Discount Applied',
        description: `${result.discount_type === 'percentage' ? `${result.discount_value}% off` : `₦${result.discount_value.toLocaleString()} off`} applied to your order`,
      });
    } catch (err) {
      console.error('Error validating discount code:', err);
      setError('Failed to validate code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onRemove();
    setCode('');
    setError(null);
    toast({
      title: 'Discount Removed',
      description: 'The discount has been removed from your order',
    });
  };

  const formatDiscount = (discount: DiscountResult) => {
    if (discount.discount_type === 'percentage') {
      return `${discount.discount_value}% off`;
    }
    return `₦${discount.discount_value.toLocaleString()} off`;
  };

  // Show applied discount
  if (appliedDiscount) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 rounded-full">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-green-800">
                  {appliedDiscount.code}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {formatDiscount(appliedDiscount)}
                </Badge>
              </div>
              {appliedDiscount.description && (
                <p className="text-xs text-green-600">{appliedDiscount.description}</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter discount code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApply();
              }
            }}
            className="pl-9"
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          variant="outline"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Apply'
          )}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
