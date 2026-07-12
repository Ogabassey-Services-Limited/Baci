'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface RateFeeFieldsProps {
  freeOverAmount: string;
  onFreeOverAmountChange: (value: string) => void;
  deliveryMinDays: string;
  onDeliveryMinDaysChange: (value: string) => void;
  deliveryMaxDays: string;
  onDeliveryMaxDaysChange: (value: string) => void;
  currencySymbol: string;
}

/** Free-over threshold + delivery day estimate fields for a rate. */
export function RateFeeFields({
  freeOverAmount,
  onFreeOverAmountChange,
  deliveryMinDays,
  onDeliveryMinDaysChange,
  deliveryMaxDays,
  onDeliveryMaxDaysChange,
  currencySymbol,
}: RateFeeFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="rate-free-over">
          Free when order total is over ({currencySymbol})
        </Label>
        <Input
          id="rate-free-over"
          type="number"
          min="0"
          step="0.01"
          value={freeOverAmount}
          onChange={(event) => onFreeOverAmountChange(event.target.value)}
          placeholder="Never free"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="rate-delivery-min">Delivery days (min)</Label>
          <Input
            id="rate-delivery-min"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={deliveryMinDays}
            onChange={(event) => onDeliveryMinDaysChange(event.target.value)}
            placeholder="2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rate-delivery-max">Delivery days (max)</Label>
          <Input
            id="rate-delivery-max"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={deliveryMaxDays}
            onChange={(event) => onDeliveryMaxDaysChange(event.target.value)}
            placeholder="4"
          />
        </div>
      </div>
    </>
  );
}
