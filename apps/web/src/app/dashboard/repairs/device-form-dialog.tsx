'use client';

import type { RepairDeviceType } from '@baci/shared/repairs';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { TagInput } from '@/components/ui/tag-input';
import { useToast } from '@/hooks/use-toast';
import type { RepairDeviceAdmin } from '@/lib/repairs/catalog-admin-mappers';
import { REPAIR_DEVICE_TYPES } from '@/schemas/repair-catalog-admin';
import { createDevice, updateDevice } from './catalog-api';
import ProductPicker, { type ProductPickerValue } from './product-picker';

/**
 * Create/edit dialog for a single repairs-catalogue device.
 *
 * `open` is fully controlled by the caller (DevicesManager) so the same
 * instance can be reused for both the "Add device" and per-row "Edit"
 * actions.
 */

const NO_DEVICE_TYPE = 'none';

interface FormState {
  brand: string;
  model: string;
  deviceType: RepairDeviceType | typeof NO_DEVICE_TYPE;
  aliases: string[];
  imageUrl: string;
  isActive: boolean;
  product: ProductPickerValue | null;
}

// The admin device record only stores `productId`, not the linked product's
// name, so an existing link is rendered with a short label derived from the
// id rather than a fetched product name.
function linkedProductLabel(productId: string): string {
  return `Linked product · ${productId.slice(0, 8)}…`;
}

function toFormState(device: RepairDeviceAdmin | null | undefined): FormState {
  if (!device) {
    return {
      brand: '',
      model: '',
      deviceType: NO_DEVICE_TYPE,
      aliases: [],
      imageUrl: '',
      isActive: true,
      product: null,
    };
  }
  return {
    brand: device.brand,
    model: device.model,
    deviceType: device.deviceType ?? NO_DEVICE_TYPE,
    aliases: device.aliases,
    imageUrl: device.imageUrl ?? '',
    isActive: device.isActive,
    product: device.productId
      ? { id: device.productId, name: linkedProductLabel(device.productId) }
      : null,
  };
}

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: RepairDeviceAdmin | null;
  onSaved: (device: RepairDeviceAdmin) => void;
}

export default function DeviceFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: DeviceFormDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toFormState(initial));
      setValidationError(null);
    }
  }, [open, initial]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const brand = form.brand.trim();
    const model = form.model.trim();
    if (!brand || !model) {
      setValidationError('Brand and model are required.');
      return;
    }
    setValidationError(null);

    const payload = {
      brand,
      model,
      deviceType: form.deviceType === NO_DEVICE_TYPE ? null : form.deviceType,
      productId: form.product?.id ?? null,
      aliases: form.aliases,
      imageUrl: form.imageUrl.trim() || null,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      const saved = initial
        ? await updateDevice(initial.id, payload)
        : await createDevice(payload);
      toast({ title: initial ? 'Device updated' : 'Device added' });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: initial ? 'Could not update device' : 'Could not add device',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit device' : 'Add device'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device-brand">Brand</Label>
              <Input
                id="device-brand"
                value={form.brand}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    brand: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-model">Model</Label>
              <Input
                id="device-model"
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    model: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-type">Device type</Label>
            <Select
              name="deviceType"
              value={form.deviceType}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  deviceType: value as FormState['deviceType'],
                }))
              }
            >
              <SelectTrigger id="device-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEVICE_TYPE}>None</SelectItem>
                {REPAIR_DEVICE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-aliases">Aliases</Label>
            <TagInput
              value={form.aliases}
              onChange={(aliases) =>
                setForm((current) => ({ ...current, aliases }))
              }
              placeholder="Alternate names…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-image-url">Image URL</Label>
            <Input
              id="device-image-url"
              value={form.imageUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  imageUrl: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label id="device-linked-product-label">Linked product</Label>
            <ProductPicker
              value={form.product}
              onChange={(product) =>
                setForm((current) => ({ ...current, product }))
              }
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="device-active"
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, isActive: checked }))
              }
            />
            <Label htmlFor="device-active">Active</Label>
          </div>

          {validationError ? (
            <p className="text-sm text-destructive">{validationError}</p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
