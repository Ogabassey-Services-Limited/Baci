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
  // Bill customer info (electricity / cable / betting)
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(1).optional(),
  // Common optional fields
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  source: z
    .enum(['checkout', 'loyalty_reward', 'direct', 'gift', 'storefront_modal'])
    .default('direct'),
  // Wallet payment leg. Optional; when present, the customer's wallet
  // covers `walletAmount` of the bill and the gateway charges
  // `amount - walletAmount` (residual). `walletAmount === amount` is the
  // wallet-only path. Cross-field rule (walletAmount <= amount) is in
  // applyPurchaseRequirements so every derived schema picks it up.
  walletAmount: z.number().nonnegative().optional(),
});

type PurchaseRequirementValues = z.infer<typeof purchaseSchemaBase>;

function applyPurchaseRequirements(
  data: PurchaseRequirementValues,
  ctx: z.RefinementCtx
) {
  if (data.type === 'airtime' || data.type === 'data') {
    if (!data.phoneNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'phoneNumber is required for airtime/data',
        path: ['phoneNumber'],
      });
    }

    if (!data.networkProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'networkProvider is required for airtime/data',
        path: ['networkProvider'],
      });
    }
  }

  if (data.type === 'data' && !data.dataPlanCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'dataPlanCode is required for data purchases',
      path: ['dataPlanCode'],
    });
  }

  if (
    data.type === 'electricity' ||
    data.type === 'cable_tv' ||
    data.type === 'betting'
  ) {
    if (!data.billItemIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'billItemIdentifier is required for bill payments',
        path: ['billItemIdentifier'],
      });
    }

    if (!data.customerIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'customerIdentifier is required for bill payments',
        path: ['customerIdentifier'],
      });
    }
  }

  if (data.walletAmount !== undefined && data.walletAmount > data.amount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'walletAmount cannot exceed amount',
      path: ['walletAmount'],
    });
  }

  // Wallet credit is a customer-paid leg, only valid for the
  // `checkout` source. Loyalty rewards, gifts, direct purchases, and
  // the storefront modal are settled via different paths (merchant
  // pre-funding, gateway only, etc.) and the refund helper in
  // `vtu-fulfillment.ts:327` skips non-checkout rows — so a wallet
  // debit triggered by a non-checkout flow would leave the customer
  // permanently charged on a vend failure.
  if (
    data.walletAmount !== undefined &&
    data.walletAmount > 0 &&
    data.source !== 'checkout'
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'walletAmount is only valid for checkout-sourced purchases',
      path: ['walletAmount'],
    });
  }
}

export const purchaseSchema = purchaseSchemaBase.superRefine(
  applyPurchaseRequirements
);

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

export const vtuCheckoutInitializeSchema = purchaseSchemaBase
  .extend({
    gateway: vtuCheckoutGatewayEnum,
  })
  .superRefine(applyPurchaseRequirements);

export const vtuCheckoutConfirmSchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
  gateway: z.enum(['paystack', 'korapay']),
  reference: z.string().min(1, 'Payment reference is required'),
});

export const vtuSavedPaymentMethodsQuerySchema = z.object({
  merchantSlug: z.string().min(1, 'Merchant slug is required'),
});

export const vtuSavedCardChargeSchema = purchaseSchemaBase
  .extend({
    gateway: vtuCheckoutGatewayEnum,
    savedPaymentMethodId: z.string().uuid('Saved payment method id is invalid'),
  })
  .superRefine(applyPurchaseRequirements);

// Wallet-only VTU checkout. Requires walletAmount > 0; the route
// additionally enforces walletAmount === amount (full coverage).
export const vtuWalletOnlyChargeSchema = purchaseSchemaBase
  .extend({
    walletAmount: z
      .number()
      .positive('walletAmount is required for wallet-only checkout'),
  })
  .superRefine(applyPurchaseRequirements);

export type VtuWalletOnlyChargeInput = z.infer<
  typeof vtuWalletOnlyChargeSchema
>;

/** Maps our bill type enum to commission calculation categories */
export const COMMISSION_CATEGORY_MAP: Record<BillType, string> = {
  airtime: 'AIRTIME',
  data: 'DATA',
  electricity: 'ELECTRICITY',
  cable_tv: 'CABLE',
  betting: 'BETTING',
};
