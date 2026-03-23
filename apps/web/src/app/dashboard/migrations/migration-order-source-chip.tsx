'use client';

import { getOrderSourceLabel } from '@/app/dashboard/orders/order-source-display';
import { OrderSourceIcon } from '@/app/dashboard/orders/order-source-icon';
import { Badge } from '@/components/ui/badge';
import { mapBumpaOrderSource } from '@/lib/imports/bumpa/map-bumpa-order-source';

interface MigrationOrderSourceChipProps {
  sourceChannel?: string | null;
  sourceOrigin?: string | null;
}

export default function MigrationOrderSourceChip({
  sourceChannel,
  sourceOrigin,
}: MigrationOrderSourceChipProps) {
  const source = mapBumpaOrderSource(sourceOrigin, sourceChannel);

  return (
    <Badge
      className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-foreground"
      variant="outline"
    >
      <OrderSourceIcon source={source} />
      <span>{getOrderSourceLabel(source)}</span>
    </Badge>
  );
}
