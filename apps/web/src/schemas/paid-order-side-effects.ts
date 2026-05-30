import { z } from 'zod';

function hasAtMostTwoDecimalPlaces(value: number) {
  const minorUnits = value * 100;
  return Math.abs(minorUnits - Math.round(minorUnits)) < 1e-9;
}

const moneyNumberSchema = z
  .number()
  .finite()
  .nonnegative()
  .refine(hasAtMostTwoDecimalPlaces, {
    message: 'must have at most two decimal places',
  });

export const moneyInputSchema = z.union([
  moneyNumberSchema,
  z
    .string()
    .regex(/^\+?\d+(?:\.\d{1,2})?$/, {
      message: 'must be a valid non-negative money amount',
    })
    .transform(Number)
    .pipe(moneyNumberSchema),
]);

export const paidOrderSideEffectTransactionSchema = z
  .object({
    amount: moneyInputSchema,
    gateway_reference: z
      .string()
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    id: z.string().trim().min(1),
    merchant_id: z.string().trim().min(1),
    order_id: z.string().trim().min(1),
    platform_fee: moneyInputSchema.nullish(),
  })
  .passthrough();
