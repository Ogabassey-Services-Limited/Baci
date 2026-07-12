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
import { useToast } from '@/hooks/use-toast';
import type { ZoneLocationFormInput } from '@/schemas/merchant-shipping-rate-forms';
import { upsertZone } from './actions';
import { LocationPicker } from './location-picker';
import type { ShippingZone } from './shipping-types';

interface ZoneFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` creates a new zone; otherwise edits this one. */
  zone: ShippingZone | null;
  onSaved: () => void;
}

/**
 * Create/rename a zone and edit its locations. Keyed by `zone?.id` in the
 * parent so switching between "create" and "edit <zone>" remounts the form
 * with fresh state instead of syncing props via an effect.
 */
export function ZoneFormDialog({
  open,
  onOpenChange,
  zone,
  onSaved,
}: ZoneFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <ZoneFormDialogBody
          key={zone?.id ?? 'new'}
          zone={zone}
          onSaved={onSaved}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function ZoneFormDialogBody({
  zone,
  onSaved,
  onOpenChange,
}: {
  zone: ShippingZone | null;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(zone?.name ?? '');
  const [locations, setLocations] = useState<ZoneLocationFormInput[]>(
    zone?.locations.map((location) => ({
      countryCode: location.countryCode,
      subdivisionCode: location.subdivisionCode,
    })) ?? []
  );

  // The rest-of-world zone matches any destination by definition — its
  // location editor is never shown, and its locations are always sent empty.
  const isRestOfWorld = zone?.isRestOfWorld ?? false;

  // biome-ignore lint/suspicious/useAwait: async needed for startTransition with Server Action
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Zone name is required',
        variant: 'destructive',
      });
      return;
    }

    startTransition(async () => {
      try {
        await upsertZone({
          id: zone?.id,
          name,
          locations: isRestOfWorld ? [] : locations,
        });
        toast({
          title: zone ? 'Updated!' : 'Created!',
          description: `Zone "${name}" has been saved.`,
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
        <DialogTitle>{zone ? 'Edit Zone' : 'Create Zone'}</DialogTitle>
        <DialogDescription>
          {isRestOfWorld
            ? 'Your delivery fallback zone. It always matches any destination not covered by another zone, so it has no locations of its own.'
            : 'Group destinations that should share the same delivery rates.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="zone-name">Zone name</Label>
        <Input
          id="zone-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Lagos"
          required
        />
      </div>

      {!isRestOfWorld && (
        <LocationPicker value={locations} onChange={setLocations} />
      )}

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
          ) : zone ? (
            'Save Changes'
          ) : (
            'Create Zone'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
