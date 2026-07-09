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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { RepairServiceTypeAdmin } from '@/lib/repairs/catalog-admin-mappers';
import { createServiceType, updateServiceType } from './catalog-api';

interface FormState {
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  sortOrder: '',
  isActive: true,
};

function toFormState(serviceType: RepairServiceTypeAdmin | null): FormState {
  if (!serviceType) {
    return EMPTY_FORM;
  }

  return {
    name: serviceType.name,
    description: serviceType.description ?? '',
    sortOrder: String(serviceType.sortOrder),
    isActive: serviceType.isActive,
  };
}

interface ServiceTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RepairServiceTypeAdmin | null;
  onSaved: (serviceType: RepairServiceTypeAdmin) => void;
}

export default function ServiceTypeFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: ServiceTypeFormDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(initial));
    }
  }, [open, initial]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      return;
    }

    const payload = {
      name,
      description: form.description.trim() || null,
      sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : undefined,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      const saved = initial
        ? await updateServiceType(initial.id, payload)
        : await createServiceType(payload);
      toast({ title: initial ? 'Service type updated' : 'Service type added' });
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        title: initial
          ? 'Could not update service type'
          : 'Could not add service type',
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
          <DialogTitle>
            {initial ? 'Edit service type' : 'Add service type'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-type-name">Name</Label>
            <Input
              id="service-type-name"
              required
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-type-description">Description</Label>
            <Textarea
              id="service-type-description"
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-type-sort-order">Sort order</Label>
            <Input
              id="service-type-sort-order"
              type="number"
              value={form.sortOrder}
              onChange={(event) => setField('sortOrder', event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="service-type-active"
              checked={form.isActive}
              onCheckedChange={(checked) => setField('isActive', checked)}
            />
            <Label htmlFor="service-type-active">Active</Label>
          </div>
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
