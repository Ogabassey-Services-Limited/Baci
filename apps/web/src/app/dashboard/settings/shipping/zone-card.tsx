'use client';

import { Edit, Globe2, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RateRow } from './rate-row';
import { formatLocationLabel } from './shipping-format';
import type { ShippingRate, ShippingZone } from './shipping-types';

interface ZoneCardProps {
  zone: ShippingZone;
  rates: ShippingRate[];
  onEditZone: () => void;
  onDeleteZoneRequested: () => void;
  onAddRate: () => void;
  onEditRate: (rate: ShippingRate) => void;
  onDeleteRateRequested: (rate: ShippingRate) => void;
  onToggleRateActive: (rate: ShippingRate, active: boolean) => void;
  togglingRateId: string | null;
}

export function ZoneCard({
  zone,
  rates,
  onEditZone,
  onDeleteZoneRequested,
  onAddRate,
  onEditRate,
  onDeleteRateRequested,
  onToggleRateActive,
  togglingRateId,
}: ZoneCardProps) {
  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            {zone.isRestOfWorld && (
              <Globe2 className="size-4 text-muted-foreground" />
            )}
            {zone.name}
            {zone.isRestOfWorld && <Badge variant="secondary">Fallback</Badge>}
          </CardTitle>
          {zone.isRestOfWorld ? (
            <p className="text-sm text-muted-foreground">
              Matches any destination not covered by another zone.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {zone.locations.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  No locations yet
                </span>
              ) : (
                zone.locations.map((location) => (
                  <Badge
                    key={`${location.countryCode}-${location.subdivisionCode ?? 'all'}`}
                    variant="outline"
                  >
                    {formatLocationLabel(location)}
                  </Badge>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEditZone}
            aria-label={`Edit ${zone.name}`}
          >
            <Edit className="size-4" />
          </Button>
          {zone.isRestOfWorld ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled
                      aria-label="Delete disabled: this is the fallback zone"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  This is your delivery fallback and can&apos;t be deleted.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDeleteZoneRequested}
              aria-label={`Delete ${zone.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {rates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No delivery options yet.
          </p>
        ) : (
          <div className="space-y-2">
            {rates.map((rate) => (
              <RateRow
                key={rate.id}
                rate={rate}
                onEdit={() => onEditRate(rate)}
                onDeleteRequested={() => onDeleteRateRequested(rate)}
                onToggleActive={(active) => onToggleRateActive(rate, active)}
                isToggling={togglingRateId === rate.id}
              />
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={onAddRate}>
          <Plus className="mr-2 size-4" />
          Add rate
        </Button>
      </CardContent>
    </Card>
  );
}
