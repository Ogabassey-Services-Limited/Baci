import { z } from 'zod';

export const billTypeEnum = z.enum([
  'airtime',
  'data',
  'electricity',
  'cable_tv',
  'betting',
]);
export type BillType = z.infer<typeof billTypeEnum>;

const purchaseSchemaBase = z.object({
  merchantSlug: z.string().min(1),
  amount: z.number().min(50).max(500000),
  type: billTypeEnum,
  // Airtime/Data fields
  phoneNumber: z.string().optional(),
  networkProvider: z.string().optional(),
  dataPlanCode: z.string().optional(),
  // Bill payment fields (TV, Power, Betting)
  billItemIdentifier: z.string().optional(),
  customerIdentifier: z.string().optional(),
  billerName: z.string().optional(),
  // Common optional fields
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  source: z
    .enum(['checkout', 'loyalty_reward', 'direct', 'gift', 'storefront_modal'])
    .default('direct'),
});

function withPurchaseRequirements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (data) => {
        if (data.type === 'airtime' || data.type === 'data') {
          return !!data.phoneNumber && !!data.networkProvider;
        }
        return true;
      },
      {
        message:
          'phoneNumber and networkProvider are required for airtime/data',
        path: ['phoneNumber'],
      }
    )
    .refine(
      (data) => {
        if (
          data.type === 'electricity' ||
          data.type === 'cable_tv' ||
          data.type === 'betting'
        ) {
          return !!data.billItemIdentifier && !!data.customerIdentifier;
        }
        return true;
      },
      {
        message:
          'billItemIdentifier and customerIdentifier are required for bill payments',
        path: ['billItemIdentifier'],
      }
    );
}

export const purchaseSchema = withPurchaseRequirements(purchaseSchemaBase);

export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const verifySchema = z.object({
  billItemIdentifier: z.string().min(1, 'Bill item identifier is required'),
  customerIdentifier: z.string().min(1, 'Customer identifier is required'),
});

export type VerifyInput = z.infer<typeof verifySchema>;

export const billersQuerySchema = z.object({
  type: billTypeEnum,
});

export const historyQuerySchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  type: billTypeEnum.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const vtuCheckoutGatewayEnum = z.enum([
  'paystack',
  'korapay',
  'bank_transfer',
]);

export const vtuCheckoutInitializeSchema = withPurchaseRequirements(
  purchaseSchemaBase.extend({
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(1).optional(),
    gateway: vtuCheckoutGatewayEnum,
  })
);

export const vtuCheckoutConfirmSchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  gateway: z.enum(['paystack', 'korapay']),
  reference: z.string().min(1, 'Payment reference is required'),
});

export const vtuSavedPaymentMethodsQuerySchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
});

export const vtuSavedCardChargeSchema = withPurchaseRequirements(
  purchaseSchemaBase.extend({
    customerName: z.string().min(1).optional(),
    customerPhone: z.string().min(1).optional(),
    gateway: vtuCheckoutGatewayEnum,
    savedPaymentMethodId: z.string().uuid('Saved payment method id is invalid'),
  })
);

/** Maps our bill type enum to commission calculation categories */
export const COMMISSION_CATEGORY_MAP: Record<BillType, string> = {
  airtime: 'AIRTIME',
  data: 'DATA',
  electricity: 'ELECTRICITY',
  cable_tv: 'CABLE',
  betting: 'BETTING',
};
