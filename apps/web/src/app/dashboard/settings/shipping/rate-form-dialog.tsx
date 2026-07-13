'use client';

import { useState, useTransition } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type {
  MerchantPickupAddress,
  MerchantRateConditionType,
  MerchantRateKind,
} from '@/lib/shipping/merchant-rates/types';
import { PickupAddressFields } from './pickup-address-fields';
import { upsertRate } from './rate-actions';
import { RateConditionFields } from './rate-condition-fields';
import { RateFeeFields } from './rate-fee-fields';
import type { ShippingRate } from './shipping-types';

/** `''` -> `null`; otherwise the parsed number (NaN input also -> null). */
function parseOptionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface RateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoneId: string;
  /** `null` creates a new rate; otherwise edits this one. */
  rate: ShippingRate | null;
  currencySymbol: string;
  onSaved: () => void;
}

/**
 * Create/update a rate. Currency is never collected here — the server always
 * stamps the merchant's resolved currency (`resolveMerchantCurrencyConfig`),
 * so this form has no currency field to show or submit.
 */
export function RateFormDialog({
  open,
  onOpenChange,
  zoneId,
  rate,
  currencySymbol,
  onSaved,
}: RateFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {/*
         * Keying the create form by `zoneId` forces a fresh mount whenever the
         * "Add Rate" target zone changes. The parent keeps its dialog mounted
         * (it only toggles `open`) and every create flow would otherwise share a
         * constant `key`, so switching zones — or reopening after a create /
         * cancel — could reuse the prior zone's form state (name, amount, type,
         * pickup address) and save it against the new zone. The edit form stays
         * keyed by the rate id, so editing an existing rate is unaffected.
         */}
        <RateFormDialogBody
          key={rate?.id ?? `new-${zoneId}`}
          zoneId={zoneId}
          rate={rate}
          currencySymbol={currencySymbol}
          onSaved={onSaved}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function RateFormDialogBody({
  zoneId,
  rate,
  currencySymbol,
  onSaved,
  onOpenChange,
}: {
  zoneId: string;
  rate: ShippingRate | null;
  currencySymbol: string;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(rate?.name ?? '');
  const [kind, setKind] = useState<MerchantRateKind>(rate?.kind ?? 'ship');
  const [baseAmount, setBaseAmount] = useState(
    rate ? String(rate.baseAmount) : ''
  );
  const [conditionType, setConditionType] = useState<MerchantRateConditionType>(
    rate?.conditionType ?? 'always'
  );
  const [minSubtotal, setMinSubtotal] = useState(
    rate?.minSubtotal !== null && rate?.minSubtotal !== undefined
      ? String(rate.minSubtotal)
      : ''
  );
  const [maxSubtotal, setMaxSubtotal] = useState(
    rate?.maxSubtotal !== null && rate?.maxSubtotal !== undefined
      ? String(rate.maxSubtotal)
      : ''
  );
  const [freeOverAmount, setFreeOverAmount] = useState(
    rate?.freeOverAmount !== null && rate?.freeOverAmount !== undefined
      ? String(rate.freeOverAmount)
      : ''
  );
  const [deliveryMinDays, setDeliveryMinDays] = useState(
    rate?.deliveryMinDays !== null && rate?.deliveryMinDays !== undefined
      ? String(rate.deliveryMinDays)
      : ''
  );
  const [deliveryMaxDays, setDeliveryMaxDays] = useState(
    rate?.deliveryMaxDays !== null && rate?.deliveryMaxDays !== undefined
      ? String(rate.deliveryMaxDays)
      : ''
  );
  const [pickupAddress, setPickupAddress] = useState<MerchantPickupAddress>(
    rate?.pickupAddress ?? {}
  );
  const [active, setActive] = useState(rate?.active ?? true);

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    startTransition(async () => {
      try {
        await upsertRate({
          id: rate?.id,
          zoneId,
          name,
          kind,
          baseAmount: Number(baseAmount) || 0,
          conditionType,
          minSubtotal: parseOptionalNumber(minSubtotal),
          maxSubtotal: parseOptionalNumber(maxSubtotal),
          freeOverAmount: parseOptionalNumber(freeOverAmount),
          deliveryMinDays: parseOptionalNumber(deliveryMinDays),
          deliveryMaxDays: parseOptionalNumber(deliveryMaxDays),
          pickupAddress: kind === 'pickup' ? pickupAddress : null,
          sortOrder: rate?.sortOrder ?? 0,
          active,
        });
        toast({
          title: rate ? 'Updated!' : 'Created!',
          description: `Rate "${name}" has been saved.`,
        });
        onOpenChange(false);
        onSaved();
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{rate ? 'Edit Rate' : 'Create Rate'}</DialogTitle>
        <DialogDescription>
          {rate
            ? 'Update this delivery option.'
            : 'Add a delivery option to this zone.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="rate-name">Name</Label>
          <Input
            id="rate-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Standard delivery"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate-kind">Type</Label>
          <Select
            value={kind}
            onValueChange={(value: MerchantRateKind) => setKind(value)}
          >
            <SelectTrigger id="rate-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ship">Delivery</SelectItem>
              <SelectItem value="pickup">Local pickup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate-base-amount">Price ({currencySymbol})</Label>
          <Input
            id="rate-base-amount"
            type="number"
            min="0"
            step="0.01"
            value={baseAmount}
            onChange={(event) => setBaseAmount(event.target.value)}
            required
          />
        </div>
      </div>

      <RateConditionFields
        conditionType={conditionType}
        onConditionTypeChange={setConditionType}
        minSubtotal={minSubtotal}
        onMinSubtotalChange={setMinSubtotal}
        maxSubtotal={maxSubtotal}
        onMaxSubtotalChange={setMaxSubtotal}
        currencySymbol={currencySymbol}
      />

      <RateFeeFields
        freeOverAmount={freeOverAmount}
        onFreeOverAmountChange={setFreeOverAmount}
        deliveryMinDays={deliveryMinDays}
        onDeliveryMinDaysChange={setDeliveryMinDays}
        deliveryMaxDays={deliveryMaxDays}
        onDeliveryMaxDaysChange={setDeliveryMaxDays}
        currencySymbol={currencySymbol}
      />

      {kind === 'pickup' && (
        <PickupAddressFields
          value={pickupAddress}
          onChange={setPickupAddress}
        />
      )}

      <div className="flex items-center gap-x-2">
        <Switch id="rate-active" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="rate-active">Active</Label>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <BagLoader size={16} />
              Saving…
            </>
          ) : rate ? (
            'Save Changes'
          ) : (
            'Create Rate'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
