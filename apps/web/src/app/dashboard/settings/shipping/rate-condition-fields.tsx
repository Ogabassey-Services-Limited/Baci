'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MerchantRateConditionType } from '@/lib/shipping/merchant-rates/types';

interface RateConditionFieldsProps {
  conditionType: MerchantRateConditionType;
  onConditionTypeChange: (value: MerchantRateConditionType) => void;
  minSubtotal: string;
  onMinSubtotalChange: (value: string) => void;
  maxSubtotal: string;
  onMaxSubtotalChange: (value: string) => void;
  currencySymbol: string;
}

/** When a rate applies: always, or only within a subtotal tier. */
export function RateConditionFields({
  conditionType,
  onConditionTypeChange,
  minSubtotal,
  onMinSubtotalChange,
  maxSubtotal,
  onMaxSubtotalChange,
  currencySymbol,
}: RateConditionFieldsProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="rate-condition-type">Applies</Label>
      <Select
        value={conditionType}
        onValueChange={(value: MerchantRateConditionType) =>
          onConditionTypeChange(value)
        }
      >
        <SelectTrigger id="rate-condition-type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="always">Always</SelectItem>
          <SelectItem value="price_tier">Order subtotal range</SelectItem>
        </SelectContent>
      </Select>

      {conditionType === 'price_tier' && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-2">
            <Label htmlFor="rate-min-subtotal">
              Min subtotal ({currencySymbol})
            </Label>
            <Input
              id="rate-min-subtotal"
              type="number"
              min="0"
              step="0.01"
              value={minSubtotal}
              onChange={(event) => onMinSubtotalChange(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate-max-subtotal">
              Max subtotal ({currencySymbol})
            </Label>
            <Input
              id="rate-max-subtotal"
              type="number"
              min="0"
              step="0.01"
              value={maxSubtotal}
              onChange={(event) => onMaxSubtotalChange(event.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>
      )}
    </div>
  );
}
