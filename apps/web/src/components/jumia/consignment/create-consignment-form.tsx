'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Package, Plus, Trash2 } from 'lucide-react';
import type { FieldErrors } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { fetchWithCsrf } from '@/lib/api-client';
import { sanitizeText } from '@/lib/sanitize-core';
import {
  type ConsignmentFormValues,
  consignmentFormSchema,
  getLocalYYYYMMDD,
} from '@/schemas/jumia/consignment';

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
      const res = await fetchWithCsrf('/api/marketplace/jumia/consignment', {
        method: 'POST',
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
      const issues: string[] = [];
      for (let i = 0; i < fe.products.length; i++) {
        const rowErr = fe.products[i];
        if (!rowErr) continue;
        const parts: string[] = [];
        if (rowErr.sku?.message) parts.push(rowErr.sku.message);
        if (rowErr.quantity?.message) parts.push(rowErr.quantity.message);
        if (parts.length > 0) {
          issues.push(`Row ${i + 1}: ${parts.join(', ')}`);
        }
      }
      if (issues.length > 0) {
        toast({
          title: 'Validation Error',
          description: issues.join('; '),
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
