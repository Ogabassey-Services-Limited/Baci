import { z } from 'zod';

const nonEmptyRawStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Required');

const creditDirectNumericStringSchema = z
  .string()
  .regex(/^[0-9]+(?:\.[0-9]{1,2})?$/, 'Invalid amount format')
  .refine((value) => Number(value) > 0, 'Amount must be positive');

function hasCreditDirectAmountPrecision(value: number) {
  const serialized = value.toString();
  if (serialized.includes('e')) {
    return Number.isInteger(value);
  }

  return (serialized.split('.')[1]?.length ?? 0) <= 2;
}

const creditDirectRawAmountSchema = z.union([
  z
    .number()
    .finite()
    .positive()
    .refine(hasCreditDirectAmountPrecision, 'Invalid amount format'),
  creditDirectNumericStringSchema,
]);

const creditDirectAmountSchema = creditDirectRawAmountSchema
  .transform((value) => (typeof value === 'number' ? value : Number(value)))
  .pipe(z.number().positive());

export const creditDirectSignSchema = z.object({
  customerEmail: z.email().max(254),
  totalAmount: creditDirectAmountSchema,
  merchantSlug: z.string().min(1),
  orderId: z.uuid(),
});

export type CreditDirectSignInput = z.infer<typeof creditDirectSignSchema>;

export const creditDirectWebhookProductSchema = z.object({
  productName: nonEmptyRawStringSchema,
  productAmount: creditDirectAmountSchema,
  productId: nonEmptyRawStringSchema,
});

export const creditDirectWebhookSchema = z.object({
  checkoutCustomer: z.object({
    firstName: z.string(),
    lastName: z.string(),
  }),
  checkoutTransactionId: nonEmptyRawStringSchema,
  eventType: z.enum([
    'Checkout_Customer_Payment_Completed',
    'Checkout_Merchant_Payment_Completed',
  ]),
  metaData: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  products: z.array(creditDirectWebhookProductSchema),
  timeStamp: nonEmptyRawStringSchema,
});

export type CreditDirectWebhookProductInput = z.infer<
  typeof creditDirectWebhookProductSchema
>;
export type CreditDirectWebhookInput = z.infer<
  typeof creditDirectWebhookSchema
>;
