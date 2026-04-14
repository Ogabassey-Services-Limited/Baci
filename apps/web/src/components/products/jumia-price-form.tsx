'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ThemedInput } from '@/components/themed/themed-input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import {
  type JumiaPriceFormValues,
  jumiaPriceSchema,
} from '@/schemas/jumia/price-form';

const ngnFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
});

interface JumiaOverrides {
  price: string;
  salePrice: string;
  saleStart: string;
  saleEnd: string;
  isActive: boolean;
  syncInventory: boolean;
  syncPrice: boolean;
}

interface JumiaPriceFormProps {
  overrides: JumiaOverrides;
  setOverrides: React.Dispatch<React.SetStateAction<JumiaOverrides>>;
  basePrice: number;
}

export function JumiaPriceForm({
  overrides,
  setOverrides,
  basePrice,
}: JumiaPriceFormProps) {
  const {
    register,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<z.input<typeof jumiaPriceSchema>, unknown, JumiaPriceFormValues>({
    resolver: zodResolver(jumiaPriceSchema),
    mode: 'onChange',
    defaultValues: {
      jumiaPrice:
        overrides.price || overrides.price === '0'
          ? Number(overrides.price)
          : undefined,
      jumiaSalePrice:
        overrides.salePrice || overrides.salePrice === '0'
          ? Number(overrides.salePrice)
          : undefined,
      saleStart: overrides.saleStart || undefined,
      saleEnd: overrides.saleEnd || undefined,
    },
  });

  // Guard ref to prevent the reset effect from firing when the form itself
  // just pushed values to the parent (avoids infinite reset <-> watch loop).
  const isFormDriven = useRef(false);

  // Resync form when overrides prop changes externally — skip when the form
  // itself triggered the change and only reset when values actually differ.
  useEffect(() => {
    if (isFormDriven.current) {
      isFormDriven.current = false;
      return;
    }

    const current = getValues();
    const incomingPrice =
      overrides.price || overrides.price === '0'
        ? Number(overrides.price)
        : undefined;
    const incomingSalePrice =
      overrides.salePrice || overrides.salePrice === '0'
        ? Number(overrides.salePrice)
        : undefined;
    const incomingSaleStart = overrides.saleStart || undefined;
    const incomingSaleEnd = overrides.saleEnd || undefined;

    const priceMatch =
      String(current.jumiaPrice ?? '') === String(incomingPrice ?? '');
    const salePriceMatch =
      String(current.jumiaSalePrice ?? '') === String(incomingSalePrice ?? '');
    const startMatch = (current.saleStart ?? '') === (incomingSaleStart ?? '');
    const endMatch = (current.saleEnd ?? '') === (incomingSaleEnd ?? '');

    if (priceMatch && salePriceMatch && startMatch && endMatch) return;

    reset({
      jumiaPrice: incomingPrice,
      jumiaSalePrice: incomingSalePrice,
      saleStart: incomingSaleStart,
      saleEnd: incomingSaleEnd,
    });
  }, [
    overrides.price,
    overrides.salePrice,
    overrides.saleStart,
    overrides.saleEnd,
    reset,
    getValues,
  ]);

  // Subscribe only to the four fields we care about (not the whole form)
  const jumiaPrice = watch('jumiaPrice');
  const jumiaSalePrice = watch('jumiaSalePrice');
  const saleStart = watch('saleStart');
  const saleEnd = watch('saleEnd');

  useEffect(() => {
    const price = String(jumiaPrice ?? '');
    const sale = String(jumiaSalePrice ?? '');
    const start = saleStart ?? '';
    const end = saleEnd ?? '';

    setOverrides((prev) => {
      if (
        prev.price === price &&
        prev.salePrice === sale &&
        prev.saleStart === start &&
        prev.saleEnd === end
      ) {
        return prev;
      }
      isFormDriven.current = true;
      return {
        ...prev,
        price,
        salePrice: sale,
        saleStart: start,
        saleEnd: end,
      };
    });
  }, [jumiaPrice, jumiaSalePrice, saleStart, saleEnd, setOverrides]);

  const isPriceWarning =
    overrides.isActive &&
    jumiaPrice != null &&
    jumiaPrice !== '' &&
    Number.isFinite(Number(jumiaPrice)) &&
    Number(jumiaPrice) < basePrice * 0.8;

  return (
    <>
      {isPriceWarning && (
        <Alert
          variant="destructive"
          className="bg-destructive/10 border-destructive/20 text-destructive"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low Price Warning</AlertTitle>
          <AlertDescription>
            Your Jumia price ({ngnFormatter.format(Number(jumiaPrice))}) is more
            than 20% lower than your base price (
            {ngnFormatter.format(basePrice)}
            ). Please verify this is intentional.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="jumia_price">Jumia Base Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">
                {'₦'}
              </span>
              <ThemedInput
                id="jumia_price"
                type="number"
                min="0"
                className="pl-7"
                placeholder={basePrice.toString()}
                {...register('jumiaPrice')}
              />
            </div>
            {errors.jumiaPrice && (
              <p className="text-[10px] text-destructive">
                {errors.jumiaPrice.message}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Leave empty to follow Baci base price
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jumia_sale_price">
              Jumia Sale Price (Optional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">
                {'₦'}
              </span>
              <ThemedInput
                id="jumia_sale_price"
                type="number"
                min="0"
                className="pl-7"
                placeholder="Set a dedicated sale price"
                {...register('jumiaSalePrice')}
              />
            </div>
            {errors.jumiaSalePrice && (
              <p className="text-[10px] text-destructive">
                {errors.jumiaSalePrice.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sale_start">Sale Start</Label>
              <ThemedInput
                id="sale_start"
                type="date"
                {...register('saleStart')}
              />
              {errors.saleStart && (
                <p className="text-[10px] text-destructive">
                  {errors.saleStart.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_end">Sale End</Label>
              <ThemedInput id="sale_end" type="date" {...register('saleEnd')} />
              {errors.saleEnd && (
                <p className="text-[10px] text-destructive">
                  {errors.saleEnd.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
