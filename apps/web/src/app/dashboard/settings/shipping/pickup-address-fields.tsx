'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MerchantPickupAddress } from '@/lib/shipping/merchant-rates/types';

interface PickupAddressFieldsProps {
  value: MerchantPickupAddress;
  onChange: (value: MerchantPickupAddress) => void;
}

/** The display-only address fields shown for a `kind: 'pickup'` rate. */
export function PickupAddressFields({
  value,
  onChange,
}: PickupAddressFieldsProps) {
  function setField(field: keyof MerchantPickupAddress, next: string) {
    onChange({ ...value, [field]: next || undefined });
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-2">
        <Label htmlFor="pickup-label">Location name</Label>
        <Input
          id="pickup-label"
          value={value.label ?? ''}
          onChange={(event) => setField('label', event.target.value)}
          placeholder="Main Store"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pickup-address">Address</Label>
        <Input
          id="pickup-address"
          value={value.address ?? ''}
          onChange={(event) => setField('address', event.target.value)}
          placeholder="12 Adeola Odeku Street"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="pickup-city">City</Label>
          <Input
            id="pickup-city"
            value={value.city ?? ''}
            onChange={(event) => setField('city', event.target.value)}
            placeholder="Lagos"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pickup-state">State</Label>
          <Input
            id="pickup-state"
            value={value.state ?? ''}
            onChange={(event) => setField('state', event.target.value)}
            placeholder="Lagos"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pickup-instructions">Pickup instructions</Label>
        <Input
          id="pickup-instructions"
          value={value.instructions ?? ''}
          onChange={(event) => setField('instructions', event.target.value)}
          placeholder="Ask for the front desk"
        />
      </div>
    </div>
  );
}
