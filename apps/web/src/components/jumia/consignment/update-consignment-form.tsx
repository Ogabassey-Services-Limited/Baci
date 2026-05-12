'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Truck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedInput } from '@/components/themed/themed-input';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { fetchWithCsrf } from '@/lib/api-client';

const updateConsignmentSchema = z
  .object({
    purchaseOrderNumber: z
      .string()
      .trim()
      .min(1, 'Purchase Order Number is required'),
    isShipped: z.boolean(),
    trackingNumber: z.string().optional(),
    actualDepartureDate: z
      .string()
      .optional()
      .refine(
        (v) => !v || !Number.isNaN(Date.parse(v)),
        'Departure date is not a valid date'
      ),
    estimatedArrivalDate: z
      .string()
      .optional()
      .refine(
        (v) => !v || !Number.isNaN(Date.parse(v)),
        'Estimated arrival is not a valid date'
      ),
    deliveryAgentPhoneNumber: z.string().optional(),
    thirdPartyLogisticsName: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.actualDepartureDate && data.estimatedArrivalDate) {
        return (
          new Date(data.estimatedArrivalDate).getTime() >=
          new Date(data.actualDepartureDate).getTime()
        );
      }
      return true;
    },
    {
      message: 'Estimated arrival must be on or after the departure date.',
      path: ['estimatedArrivalDate'],
    }
  );

type UpdateConsignmentValues = z.infer<typeof updateConsignmentSchema>;

interface UpdateConsignmentFormProps {
  integrationId: string;
}

export function UpdateConsignmentForm({
  integrationId,
}: UpdateConsignmentFormProps) {
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateConsignmentValues>({
    resolver: zodResolver(updateConsignmentSchema),
    defaultValues: {
      purchaseOrderNumber: '',
      isShipped: false,
      trackingNumber: '',
      actualDepartureDate: '',
      estimatedArrivalDate: '',
      deliveryAgentPhoneNumber: '',
      thirdPartyLogisticsName: '',
    },
  });

  const onSubmit = async (values: UpdateConsignmentValues) => {
    if (!integrationId) {
      toast({
        title: 'Missing Integration',
        description: 'No Jumia integration selected.',
        variant: 'destructive',
      });
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetchWithCsrf('/api/marketplace/jumia/consignment', {
        method: 'PATCH',
        signal: controller.signal,
        body: JSON.stringify({
          integrationId,
          purchaseOrderNumber: values.purchaseOrderNumber.trim(),
          ...(values.isShipped && { isShipped: true }),
          trackingNumber: values.trackingNumber?.trim() || undefined,
          actualDepartureDate: values.actualDepartureDate || undefined,
          estimatedArrivalDate: values.estimatedArrivalDate || undefined,
          deliveryAgentPhoneNumber:
            values.deliveryAgentPhoneNumber?.trim() || undefined,
          thirdPartyLogisticsName:
            values.thirdPartyLogisticsName?.trim() || undefined,
        }),
      });

      let data: Record<string, unknown>;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Failed to update consignment: ${res.status} - ${text}`
        );
      }
      if (!res.ok)
        throw new Error(
          (typeof data.error === 'string' ? data.error : null) ||
            'Failed to update consignment'
        );

      toast({
        title: 'Consignment Updated',
        description:
          (typeof data.message === 'string' ? data.message : null) ||
          'Shipment details have been updated.',
      });

      reset();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-store-primary" />
          <CardTitle className="text-lg">Update Consignment Order</CardTitle>
        </div>
        <CardDescription>
          Update shipping details for an existing consignment order.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="po-number">Purchase Order Number</Label>
            <ThemedInput
              id="po-number"
              type="text"
              placeholder="e.g. PO-12345"
              aria-invalid={!!errors.purchaseOrderNumber}
              {...(errors.purchaseOrderNumber && {
                'aria-describedby': 'purchaseOrderNumber-error',
              })}
              {...register('purchaseOrderNumber')}
            />
            {errors.purchaseOrderNumber ? (
              <p
                id="purchaseOrderNumber-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.purchaseOrderNumber.message}
              </p>
            ) : null}
          </div>
          <div className="flex items-end pb-1">
            <Controller
              name="isShipped"
              control={control}
              render={({ field }) => (
                // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox renders a native input internally
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(checked === true)
                    }
                  />
                  <span className="text-sm font-medium">Mark as Shipped</span>
                </label>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tracking-number">Tracking Number</Label>
            <ThemedInput
              id="tracking-number"
              type="text"
              placeholder="Optional"
              {...register('trackingNumber')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="departure-date">Departure Date</Label>
            <ThemedInput
              id="departure-date"
              type="date"
              aria-invalid={!!errors.actualDepartureDate}
              {...(errors.actualDepartureDate && {
                'aria-describedby': 'actualDepartureDate-error',
              })}
              {...register('actualDepartureDate')}
            />
            {errors.actualDepartureDate ? (
              <p
                id="actualDepartureDate-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.actualDepartureDate.message}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="arrival-date">Estimated Arrival</Label>
            <ThemedInput
              id="arrival-date"
              type="date"
              aria-invalid={!!errors.estimatedArrivalDate}
              {...(errors.estimatedArrivalDate && {
                'aria-describedby': 'estimatedArrivalDate-error',
              })}
              {...register('estimatedArrivalDate')}
            />
            {errors.estimatedArrivalDate ? (
              <p
                id="estimatedArrivalDate-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {errors.estimatedArrivalDate.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-phone">Delivery Agent Phone</Label>
            <ThemedInput
              id="agent-phone"
              type="tel"
              placeholder="Optional"
              {...register('deliveryAgentPhoneNumber')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tpl-name">3PL Name</Label>
            <ThemedInput
              id="tpl-name"
              type="text"
              placeholder="Optional"
              {...register('thirdPartyLogisticsName')}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <ThemedButton
            type="submit"
            disabled={isSubmitting || !integrationId}
            className="min-w-[180px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Shipment'
            )}
          </ThemedButton>
        </div>
      </CardContent>
    </form>
  );
}
