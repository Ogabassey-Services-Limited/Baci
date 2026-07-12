'use client';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type {
  RepairQuoteAdmin,
  RepairServiceTypeAdmin,
} from '@/lib/repairs/catalog-admin-mappers';
import { createQuote, updateQuote } from './catalog-api';

/**
 * Create/edit dialog for a single repair quote scoped to one device.
 *
 * `open` is fully controlled by the caller (DeviceQuotesPanel) so the same
 * instance can be reused for both the "Add quote" and per-row "Edit"
 * actions.
 */

interface FormState {
  serviceTypeId: string;
  price: string;
  isFromPrice: boolean;
  isActive: boolean;
  partQuality: string;
  turnaround: string;
  warrantyDays: string;
  description: string;
  internalNotes: string;
}

function toFormState(
  quote: RepairQuoteAdmin | null | undefined,
  serviceTypes: RepairServiceTypeAdmin[]
): FormState {
  if (!quote) {
    return {
      serviceTypeId: serviceTypes[0]?.id ?? '',
      price: '',
      isFromPrice: true,
      isActive: true,
      partQuality: '',
      turnaround: '',
      warrantyDays: '',
      description: '',
      internalNotes: '',
    };
  }
  return {
    serviceTypeId: quote.serviceTypeId,
    price: String(quote.price),
    isFromPrice: quote.isFromPrice,
    isActive: quote.isActive,
    partQuality: quote.partQuality ?? '',
    turnaround: quote.turnaround ?? '',
    warrantyDays: quote.warrantyDays !== null ? String(quote.warrantyDays) : '',
    description: quote.description ?? '',
    internalNotes: quote.internalNotes ?? '',
  };
}

interface QuoteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  serviceTypes: RepairServiceTypeAdmin[];
  initial?: RepairQuoteAdmin | null;
  onSaved: (quote: RepairQuoteAdmin) => void;
}

export default function QuoteFormDialog({
  open,
  onOpenChange,
  deviceId,
  serviceTypes,
  initial,
  onSaved,
}: QuoteFormDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() =>
    toFormState(initial, serviceTypes)
  );
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: serviceTypes only needs to seed the form when the dialog opens
  useEffect(() => {
    if (open) {
      setForm(toFormState(initial, serviceTypes));
      setValidationError(null);
    }
  }, [open, initial]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.serviceTypeId) {
      setValidationError('Select a service type.');
      return;
    }
    const price = Number(form.price);
    if (form.price.trim() === '' || Number.isNaN(price) || price < 0) {
      setValidationError('Enter a valid price of 0 or more.');
      return;
    }
    setValidationError(null);

    const warrantyDays = form.warrantyDays.trim()
      ? Number(form.warrantyDays)
      : null;

    const shared = {
      serviceTypeId: form.serviceTypeId,
      price,
      isFromPrice: form.isFromPrice,
      isActive: form.isActive,
      partQuality: form.partQuality.trim() || null,
      turnaround: form.turnaround.trim() || null,
      warrantyDays,
      description: form.description.trim() || null,
      internalNotes: form.internalNotes.trim() || null,
    };

    setSubmitting(true);
    try {
      const saved = initial
        ? await updateQuote(initial.id, shared)
        : await createQuote({ ...shared, deviceId });
      toast({ title: initial ? 'Quote updated' : 'Quote added' });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: initial ? 'Could not update quote' : 'Could not add quote',
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
          <DialogTitle>{initial ? 'Edit quote' : 'Add quote'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote-service-type">Service type</Label>
            <Select
              name="serviceType"
              value={form.serviceTypeId}
              onValueChange={(value) => setField('serviceTypeId', value)}
            >
              <SelectTrigger id="quote-service-type">
                <SelectValue placeholder="Select a service type" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote-price">Price</Label>
              <Input
                id="quote-price"
                type="number"
                min={0}
                value={form.price}
                onChange={(event) => setField('price', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-warranty-days">Warranty (days)</Label>
              <Input
                id="quote-warranty-days"
                type="number"
                min={0}
                value={form.warrantyDays}
                onChange={(event) =>
                  setField('warrantyDays', event.target.value)
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="quote-is-from-price"
              checked={form.isFromPrice}
              onCheckedChange={(checked) => setField('isFromPrice', checked)}
            />
            <Label htmlFor="quote-is-from-price">
              Price is a starting ("from") price
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="quote-active"
              checked={form.isActive}
              onCheckedChange={(checked) => setField('isActive', checked)}
            />
            <Label htmlFor="quote-active">
              Active (visible in the public catalogue)
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote-part-quality">Part quality</Label>
              <Input
                id="quote-part-quality"
                value={form.partQuality}
                onChange={(event) =>
                  setField('partQuality', event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote-turnaround">Turnaround</Label>
              <Input
                id="quote-turnaround"
                value={form.turnaround}
                onChange={(event) => setField('turnaround', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-description">Description</Label>
            <Textarea
              id="quote-description"
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-internal-notes">
              Internal notes (staff only)
            </Label>
            <Textarea
              id="quote-internal-notes"
              value={form.internalNotes}
              onChange={(event) =>
                setField('internalNotes', event.target.value)
              }
            />
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
