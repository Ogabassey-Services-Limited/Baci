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
  // The order's unguessable tracking token — the guest capability that gates
  // capability-token minting (S2-P). Required so an anon caller cannot forge a
  // BNPL session from just an order id + email.
  trackingToken: z.string().min(1).max(200),
});

export type CreditDirectSignInput = z.infer<typeof creditDirectSignSchema>;

export const creditDirectWebhookProductSchema = z.object({
  productName: nonEmptyRawStringSchema,
  productAmount: creditDirectAmountSchema,
  productId: nonEmptyRawStringSchema,
});

const creditDirectCamelCaseWebhookSchema = z.object({
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
  products: z.array(creditDirectWebhookProductSchema).min(1),
  timeStamp: nonEmptyRawStringSchema,
});

const creditDirectPascalCaseWebhookProductSchema = z
  .object({
    ProductName: nonEmptyRawStringSchema,
    ProductAmount: creditDirectAmountSchema,
    ProductId: nonEmptyRawStringSchema,
  })
  .transform((product) => ({
    productName: product.ProductName,
    productAmount: product.ProductAmount,
    productId: product.ProductId,
  }));

const creditDirectPascalCaseWebhookSchema = z
  .object({
    CheckoutCustomer: z.object({
      FirstName: z.string(),
      LastName: z.string(),
    }),
    CheckoutTransactionId: nonEmptyRawStringSchema,
    EventType: z.enum([
      'Checkout_Customer_Payment_Completed',
      'Checkout_Merchant_Payment_Completed',
    ]),
    MetaData: z.string().nullable().optional(),
    Products: z.array(creditDirectPascalCaseWebhookProductSchema).min(1),
    TimeStamp: nonEmptyRawStringSchema,
  })
  .transform((payload) => ({
    checkoutCustomer: {
      firstName: payload.CheckoutCustomer.FirstName,
      lastName: payload.CheckoutCustomer.LastName,
    },
    checkoutTransactionId: payload.CheckoutTransactionId,
    eventType: payload.EventType,
    metaData: payload.MetaData ?? null,
    products: payload.Products,
    timeStamp: payload.TimeStamp,
  }));

const camelCaseWebhookKeys = [
  'checkoutCustomer',
  'checkoutTransactionId',
  'eventType',
  'metaData',
  'products',
  'timeStamp',
] as const;

const pascalCaseWebhookKeys = [
  'CheckoutCustomer',
  'CheckoutTransactionId',
  'EventType',
  'MetaData',
  'Products',
  'TimeStamp',
] as const;

const camelCaseCustomerKeys = ['firstName', 'lastName'] as const;
const pascalCaseCustomerKeys = ['FirstName', 'LastName'] as const;
const camelCaseProductKeys = [
  'productName',
  'productAmount',
  'productId',
] as const;
const pascalCaseProductKeys = [
  'ProductName',
  'ProductAmount',
  'ProductId',
] as const;

function hasOwnKey(value: Record<string, unknown>, key: string) {
  return Object.hasOwn(value, key);
}

function mixesKnownKeyCasing(
  value: unknown,
  camelCaseKeys: readonly string[],
  pascalCaseKeys: readonly string[]
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    camelCaseKeys.some((key) => hasOwnKey(record, key)) &&
    pascalCaseKeys.some((key) => hasOwnKey(record, key))
  );
}

function mixesWebhookKeyCasing(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    mixesKnownKeyCasing(record, camelCaseWebhookKeys, pascalCaseWebhookKeys)
  ) {
    return true;
  }

  const customer = record.checkoutCustomer ?? record.CheckoutCustomer;
  if (
    mixesKnownKeyCasing(customer, camelCaseCustomerKeys, pascalCaseCustomerKeys)
  ) {
    return true;
  }

  const products = record.products ?? record.Products;
  return (
    Array.isArray(products) &&
    products.some((product) =>
      mixesKnownKeyCasing(product, camelCaseProductKeys, pascalCaseProductKeys)
    )
  );
}

export const creditDirectWebhookSchema = z.preprocess(
  (value) => (mixesWebhookKeyCasing(value) ? null : value),
  z.union([
    creditDirectCamelCaseWebhookSchema,
    creditDirectPascalCaseWebhookSchema,
  ])
);

export type CreditDirectWebhookProductInput = z.infer<
  typeof creditDirectWebhookProductSchema
>;
export type CreditDirectWebhookInput = z.infer<
  typeof creditDirectWebhookSchema
>;
