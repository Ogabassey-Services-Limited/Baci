'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { BarChart3, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ThemedButton } from '@/components/themed/themed-button';
import { ThemedInput } from '@/components/themed/themed-input';
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { JumiaConsignmentStockResponseSchema } from '@/schemas/jumia/consignment';

const checkStockSchema = z.object({
  sku: z.string().trim().min(1, 'Please enter a SKU'),
});

type CheckStockFormData = z.infer<typeof checkStockSchema>;

interface StockBreakdown {
  received: number;
  quarantined: number;
  defective: number;
  canceled: number;
  returned: number;
  failed: number;
}

const STOCK_ENTRIES: Array<{ label: string; key: keyof StockBreakdown }> = [
  { label: 'Received', key: 'received' },
  { label: 'Quarantined', key: 'quarantined' },
  { label: 'Defective', key: 'defective' },
  { label: 'Canceled', key: 'canceled' },
  { label: 'Returned', key: 'returned' },
  { label: 'Failed', key: 'failed' },
];

interface CheckStockSectionProps {
  integrationId: string;
  businessClientCode: string;
}

export function CheckStockSection({
  integrationId,
  businessClientCode,
}: CheckStockSectionProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckStockFormData>({
    resolver: zodResolver(checkStockSchema),
    defaultValues: { sku: '' },
  });
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState<StockBreakdown | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Reset displayed stock when integration/business context changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization (ADR-004)
  useEffect(() => {
    setStock(null);
  }, [integrationId, businessClientCode]);

  const onSubmit = async ({ sku }: CheckStockFormData) => {
    // Abort any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setStock(null);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10_000);
    try {
      const params = new URLSearchParams({
        integrationId,
        sku,
        businessClientCode,
      });
      const res = await fetch(
        `/api/marketplace/jumia/consignment?${params.toString()}`,
        { signal: controller.signal }
      );
      if (!res.ok) {
        const data: Record<string, unknown> = await res
          .json()
          .catch(() => ({}));
        throw new Error(
          (typeof data.error === 'string' ? data.error : null) ||
            'Failed to check stock'
        );
      }
      const data = await res.json();

      // Guard: only update state if this is still the active request
      if (abortControllerRef.current !== controller) return;

      const parsed = JumiaConsignmentStockResponseSchema.safeParse(data.stock);
      if (parsed.success) {
        setStock(parsed.data);
      } else {
        setStock(null);
        throw new Error('Unexpected stock data format');
      }
    } catch (err: unknown) {
      if (abortControllerRef.current !== controller) return;
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (timedOut) {
          toast({
            title: 'Stock Check Timed Out',
            description: 'The request took too long. Please try again.',
            variant: 'destructive',
          });
        }
        return;
      }
      toast({
        title: 'Stock Check Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      clearTimeout(timeoutId);
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-store-primary" />
          <CardTitle className="text-lg">Check Warehouse Stock</CardTitle>
        </div>
        <CardDescription>
          Look up current stock levels for a product in Jumia warehouses.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex items-end gap-3"
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="stock-sku">Product SKU</Label>
            <ThemedInput
              id="stock-sku"
              type="text"
              {...register('sku')}
              placeholder="Enter SKU to check"
              aria-invalid={errors.sku ? 'true' : undefined}
              aria-describedby={errors.sku ? 'stock-sku-error' : undefined}
            />
            {errors.sku && (
              <p id="stock-sku-error" className="text-sm text-destructive">
                {errors.sku.message}
              </p>
            )}
          </div>
          <ThemedButton
            type="submit"
            disabled={loading}
            aria-busy={loading}
            aria-label={loading ? 'Checking stock' : undefined}
          >
            {loading && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Check Stock
          </ThemedButton>
        </form>

        {stock && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {STOCK_ENTRIES.map(({ label, key }) => (
              <div
                key={key}
                className="flex flex-col items-center p-3 rounded-lg border bg-muted/30"
              >
                <span className="text-2xl font-bold">{stock[key]}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </>
  );
}
