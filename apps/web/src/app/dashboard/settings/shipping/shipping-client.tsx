'use client';

import { PackageSearch, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { deleteZone } from './actions';
import { deleteRate, toggleRateActive } from './rate-actions';
import { RateFormDialog } from './rate-form-dialog';
import { groupRatesByZone } from './shipping-format';
import type { ShippingRate, ShippingZone } from './shipping-types';
import { ZoneCard } from './zone-card';
import { ZoneFormDialog } from './zone-form-dialog';

interface ShippingClientProps {
  initialZones: ShippingZone[];
  initialRates: ShippingRate[];
  currencyCode: string;
  currencySymbol: string;
}

export function ShippingClient({
  initialZones,
  initialRates,
  currencySymbol,
}: ShippingClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [togglingRateId, setTogglingRateId] = useState<string | null>(null);

  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<ShippingZone | null>(null);

  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [rateDialogZoneId, setRateDialogZoneId] = useState<string | null>(null);
  const [rateToDelete, setRateToDelete] = useState<ShippingRate | null>(null);

  // Zones are ordered rest-of-world last by the loader; keep that pin here
  // too in case a caller ever re-sorts the array upstream.
  const zones = [...initialZones].sort(
    (a, b) => Number(a.isRestOfWorld) - Number(b.isRestOfWorld)
  );
  const ratesByZone = groupRatesByZone(initialRates);
  const restOfWorldZone = zones.find((zone) => zone.isRestOfWorld) ?? null;
  const hasAnyRates = initialRates.length > 0;

  function openCreateZoneDialog() {
    setEditingZone(null);
    setZoneDialogOpen(true);
  }

  function openEditZoneDialog(zone: ShippingZone) {
    setEditingZone(zone);
    setZoneDialogOpen(true);
  }

  function openCreateRateDialog(zoneId: string) {
    setEditingRate(null);
    setRateDialogZoneId(zoneId);
    setRateDialogOpen(true);
  }

  function openEditRateDialog(zoneId: string, rate: ShippingRate) {
    setEditingRate(rate);
    setRateDialogZoneId(zoneId);
    setRateDialogOpen(true);
  }

  function confirmDeleteZone() {
    if (!zoneToDelete) return;
    const zone = zoneToDelete;
    startTransition(async () => {
      try {
        await deleteZone(zone.id);
        toast({
          title: 'Deleted',
          description: `Zone "${zone.name}" removed.`,
        });
        router.refresh();
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      } finally {
        setZoneToDelete(null);
      }
    });
  }

  function confirmDeleteRate() {
    if (!rateToDelete) return;
    const rate = rateToDelete;
    startTransition(async () => {
      try {
        await deleteRate(rate.id);
        toast({
          title: 'Deleted',
          description: `Rate "${rate.name}" removed.`,
        });
        router.refresh();
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      } finally {
        setRateToDelete(null);
      }
    });
  }

  function handleToggleRateActive(rate: ShippingRate, active: boolean) {
    setTogglingRateId(rate.id);
    startTransition(async () => {
      try {
        await toggleRateActive(rate.id, active);
        router.refresh();
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      } finally {
        setTogglingRateId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Delivery Zones & Rates
          </h1>
          <p className="text-muted-foreground">
            Set your own delivery fees so customers can check out anywhere.
          </p>
        </div>
        <Button onClick={openCreateZoneDialog}>
          <Plus className="mr-2 size-4" />
          Add Zone
        </Button>
      </div>

      {!hasAnyRates && restOfWorldZone && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
          <PackageSearch className="size-10 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">
              Set your delivery fees so customers can check out anywhere
            </h3>
            <p className="text-sm text-muted-foreground">
              Add a rate to your fallback zone to start, then create more zones
              for specific regions.
            </p>
          </div>
          <Button onClick={() => openCreateRateDialog(restOfWorldZone.id)}>
            <Plus className="mr-2 size-4" />
            Add your first rate
          </Button>
        </div>
      )}

      <div className="grid gap-4">
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            rates={ratesByZone.get(zone.id) ?? []}
            onEditZone={() => openEditZoneDialog(zone)}
            onDeleteZoneRequested={() => setZoneToDelete(zone)}
            onAddRate={() => openCreateRateDialog(zone.id)}
            onEditRate={(rate) => openEditRateDialog(zone.id, rate)}
            onDeleteRateRequested={setRateToDelete}
            onToggleRateActive={handleToggleRateActive}
            togglingRateId={togglingRateId}
          />
        ))}
      </div>

      <ZoneFormDialog
        open={zoneDialogOpen}
        onOpenChange={setZoneDialogOpen}
        zone={editingZone}
        onSaved={() => router.refresh()}
      />

      {rateDialogZoneId && (
        <RateFormDialog
          open={rateDialogOpen}
          onOpenChange={setRateDialogOpen}
          zoneId={rateDialogZoneId}
          rate={editingRate}
          currencySymbol={currencySymbol}
          onSaved={() => router.refresh()}
        />
      )}

      <Dialog
        open={zoneToDelete !== null}
        onOpenChange={(open) => !open && setZoneToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Zone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{zoneToDelete?.name}</strong>? Its rates will also be
              removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setZoneToDelete(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteZone}
              disabled={isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rateToDelete !== null}
        onOpenChange={(open) => !open && setRateToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rate</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{rateToDelete?.name}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRateToDelete(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteRate}
              disabled={isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
