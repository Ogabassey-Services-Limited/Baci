'use client';

import { Clock, Edit, MapPinHouse, Trash2, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { formatAmountInCurrency } from '@/lib/resolve-merchant-currency';
import {
  formatDeliveryEstimate,
  summarizeRateCondition,
} from './shipping-format';
import type { ShippingRate } from './shipping-types';

interface RateRowProps {
  rate: ShippingRate;
  onEdit: () => void;
  onDeleteRequested: () => void;
  onToggleActive: (active: boolean) => void;
  isToggling: boolean;
}

export function RateRow({
  rate,
  onEdit,
  onDeleteRequested,
  onToggleActive,
  isToggling,
}: RateRowProps) {
  const formatAmount = (amount: number) =>
    formatAmountInCurrency(amount, rate.currency);
  const deliveryEstimate = formatDeliveryEstimate(rate);
  const Icon = rate.kind === 'pickup' ? MapPinHouse : Truck;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{rate.name}</span>
            <Badge variant={rate.active ? 'default' : 'outline'}>
              {rate.active ? 'Active' : 'Inactive'}
            </Badge>
            {rate.kind === 'pickup' && (
              <Badge variant="secondary">Pickup</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatAmount(rate.baseAmount)} ·{' '}
            {summarizeRateCondition(rate, formatAmount)}
            {rate.freeOverAmount !== null &&
              ` · Free over ${formatAmount(rate.freeOverAmount)}`}
          </p>
          {deliveryEstimate && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {deliveryEstimate}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={rate.active}
          onCheckedChange={onToggleActive}
          disabled={isToggling}
          aria-label={`${rate.active ? 'Deactivate' : 'Activate'} ${rate.name}`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label={`Edit ${rate.name}`}
        >
          <Edit className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDeleteRequested}
          aria-label={`Delete ${rate.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
