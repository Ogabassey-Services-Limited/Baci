'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Package, Plus, Trash2 } from 'lucide-react';
import type { FieldErrors } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedInput } from '@/components/themed/themed-input';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getClientCsrfToken } from '@/lib/csrf';
import { sanitizeText } from '@/lib/sanitize-core';

/** Build a yyyy-mm-dd string from local date (avoids UTC offset shifting the day). */
function getLocalYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isValidCalendarDate(v: string): boolean {
  const parts = v.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n)))
    return false;
  const [y, m, day] = parts;
  const d = new Date(y, m - 1, day);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

const productRowSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  quantity: z
    .string()
    .min(1, 'Quantity is required')
    .regex(/^\d+$/, 'Must be a whole number')
    .refine((v) => Number(v) > 0, 'Must be greater than 0'),
  labelCode: z.string(),
});

const consignmentFormSchema = z.object({
  shippingDate: z
    .string()
    .min(1, 'Shipping date is required.')
    .refine(isValidCalendarDate, { message: 'Invalid date.' })
    .refine((v) => v >= getLocalYYYYMMDD(), {
      message: 'Shipping date cannot be in the past.',
    }),
  comment: z.string(),
  products: z
    .array(productRowSchema)
    .min(1, 'At least one product with SKU and quantity is required.'),
});

type ConsignmentFormValues = z.infer<typeof consignmentFormSchema>;

interface CreateConsignmentFormProps {
  integrationId: string;
  businessClientCode: string;
}

export function CreateConsignmentForm({
  integrationId,
  businessClientCode,
}: CreateConsignmentFormProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<ConsignmentFormValues>({
    resolver: zodResolver(consignmentFormSchema),
    defaultValues: {
      shippingDate: '',
      comment: '',
      products: [{ sku: '', quantity: '', labelCode: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'products',
  });

  const onSubmit = async (values: ConsignmentFormValues) => {
    try {
      const csrfToken = getClientCsrfToken();
      const res = await fetch('/api/marketplace/jumia/consignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'x-csrf-token': csrfToken }),
        },
        body: JSON.stringify({
          integrationId,
          businessClientCode,
          shippingDate: values.shippingDate,
          comment: values.comment || undefined,
          products: values.products.map((p) => ({
            sku: p.sku.trim(),
            quantity: Number(p.quantity.trim()),
            labelCode: p.labelCode?.trim() || undefined,
          })),
        }),
      });

      const data: Record<string, unknown> = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (typeof data.error === 'string' ? data.error : null) ||
            'Failed to create consignment'
        );
      }
      const poNumber =
        typeof data.purchaseOrderNumber === 'string'
          ? sanitizeText(data.purchaseOrderNumber)
          : 'created';
      toast({
        title: 'Consignment Created',
        description: `Purchase Order: ${poNumber}`,
      });
      reset();
    } catch (err: unknown) {
      toast({
        title: 'Consignment Failed',
        description: sanitizeText(
          err instanceof Error ? err.message : 'Unknown error'
        ),
        variant: 'destructive',
      });
    }
  };

  const onInvalid = (fe: FieldErrors<ConsignmentFormValues>) => {
    if (fe.shippingDate?.message) {
      toast({
        title: 'Validation Error',
        description: fe.shippingDate.message,
        variant: 'destructive',
      });
      return;
    }
    if (fe.products?.root?.message) {
      toast({
        title: 'Validation Error',
        description: fe.products.root.message,
        variant: 'destructive',
      });
      return;
    }
    if (Array.isArray(fe.products)) {
      const rows: number[] = [];
      for (let i = 0; i < fe.products.length; i++) {
        if (fe.products[i]) rows.push(i + 1);
      }
      if (rows.length > 0) {
        const s = rows.length > 1 ? 's' : '';
        toast({
          title: 'Validation Error',
          description: `Incomplete product row${s}: ${rows.join(', ')}. Each row needs both SKU and quantity.`,
          variant: 'destructive',
        });
        return;
      }
    }
    toast({
      title: 'Validation Error',
      description: 'Please fix the form errors.',
      variant: 'destructive',
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-[var(--store-primary)]" />
          <CardTitle className="text-lg">Create Consignment Order</CardTitle>
        </div>
        <CardDescription>
          Send products to a Jumia warehouse for fulfillment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="shipping-date">Shipping Date</Label>
            <ThemedInput
              id="shipping-date"
              type="date"
              {...register('shippingDate')}
              min={getLocalYYYYMMDD()}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consignment-comment">Comment (Optional)</Label>
            <ThemedInput
              id="consignment-comment"
              type="text"
              {...register('comment')}
              placeholder="Optional notes for this consignment"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Products</Label>
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_1fr_40px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <span>SKU</span>
              <span>Qty</span>
              <span>Label Code</span>
              <span />
            </div>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_80px_1fr_40px] gap-2 px-3 py-2 border-t"
              >
                <ThemedInput
                  type="text"
                  {...register(`products.${index}.sku`)}
                  placeholder="Product SKU"
                  className="h-8 text-sm"
                  aria-label={`SKU for product row ${index + 1}`}
                />
                <ThemedInput
                  type="number"
                  {...register(`products.${index}.quantity`)}
                  placeholder="0"
                  min={1}
                  className="h-8 text-sm"
                  aria-label={`Quantity for product row ${index + 1}`}
                />
                <ThemedInput
                  type="text"
                  {...register(`products.${index}.labelCode`)}
                  placeholder="Optional"
                  className="h-8 text-sm"
                  aria-label={`Label code for product row ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  aria-label={`Remove product row ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="link"
            onClick={() => append({ sku: '', quantity: '', labelCode: '' })}
            className="flex items-center gap-1 text-sm text-[var(--store-primary)] hover:underline mt-1 h-auto p-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
        <div className="flex justify-end pt-2">
          <ThemedButton
            type="submit"
            disabled={isSubmitting}
            className="min-w-[200px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send to Jumia Warehouse'
            )}
          </ThemedButton>
        </div>
      </CardContent>
    </form>
  );
}
