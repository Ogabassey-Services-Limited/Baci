import { z } from 'zod';

const GatewayEnum = z.enum(['paystack', 'korapay', 'bank_transfer']);
const ConfirmationGatewayEnum = z.enum(['paystack', 'korapay']);

export const InitCheckoutResponseSchema = z.object({
  success: z.literal(true),
  authorization_url: z.url(),
  checkout_url: z.url().optional(),
  gateway: ConfirmationGatewayEnum,
  reference: z.string(),
  vtu_reference: z.string(),
  vtu_transaction_id: z.string(),
});

export const ConfirmCheckoutResponseSchema = z.object({
  success: z.boolean().optional(),
  status: z.enum(['successful', 'processing']),
  reference: z.string(),
  amount: z.number().optional(),
  customerIdentifier: z.string().optional(),
  voucherPin: z.string().optional(),
  cashback: z
    .object({
      amount: z.number(),
      credited: z.boolean(),
      newBalance: z.number(),
    })
    .optional(),
});

const SavedCardSchema = z.object({
  id: z.string(),
  provider: z.literal('paystack'),
  label: z.string(),
  brand: z.string().nullable(),
  bank: z.string().nullable(),
  last4: z.string().nullable(),
  exp_month: z.string().nullable(),
  exp_year: z.string().nullable(),
  is_default: z.boolean(),
});

export const SavedCardsResponseSchema = z.object({
  cards: z.array(SavedCardSchema),
});

export const ChargeSavedCardSuccessSchema = z.object({
  success: z.literal(true),
  status: z.literal('successful'),
  reference: z.string(),
  amount: z.number(),
  customerIdentifier: z.string().optional(),
  voucherPin: z.string().optional(),
  cashback: z
    .object({
      amount: z.number(),
      credited: z.boolean(),
      newBalance: z.number(),
    })
    .optional(),
});

export const ChargeSavedCardGatewaySchema = z.object({
  success: z.literal(true),
  requires_authorization: z.literal(true),
  authorization_url: z.url(),
  gateway: z.literal('paystack'),
  reference: z.string(),
});

export const ChargeSavedCardProcessingSchema = z.object({
  status: z.literal('processing'),
  reference: z.string(),
  gateway: ConfirmationGatewayEnum.optional(),
  mayRequireManualCheck: z.boolean().optional(),
  message: z.string().optional(),
  providerReference: z.string().optional(),
  refundedToWallet: z.number().optional(),
});

export const WalletOnlyVtuResponseSchema = z.object({
  status: z.enum(['successful', 'processing']),
  reference: z.string(),
  amount: z.number().optional(),
  customerIdentifier: z.string().optional(),
  voucherPin: z.string().optional(),
  cashback: z
    .object({
      amount: z.number(),
      credited: z.boolean(),
      newBalance: z.number(),
    })
    .optional(),
});

export type VTUPaymentGateway = z.infer<typeof GatewayEnum>;
export type VtuConfirmationGateway = z.infer<typeof ConfirmationGatewayEnum>;
export type VtuCheckoutConfirmation = z.infer<
  typeof ConfirmCheckoutResponseSchema
>;
export type SavedVtuCard = z.infer<typeof SavedCardSchema>;
export type SavedVtuCardChargeSuccess = z.infer<
  typeof ChargeSavedCardSuccessSchema
>;
export type SavedVtuCardChargeAuthorizationRequired = z.infer<
  typeof ChargeSavedCardGatewaySchema
>;
export type SavedVtuCardChargeProcessing = z.infer<
  typeof ChargeSavedCardProcessingSchema
>;
export type SavedVtuCardChargeResult =
  | SavedVtuCardChargeSuccess
  | SavedVtuCardChargeAuthorizationRequired
  | SavedVtuCardChargeProcessing;
export type WalletOnlyVtuResult = z.infer<typeof WalletOnlyVtuResponseSchema>;

export interface VTUCheckoutPayload {
  amount: number;
  billItemIdentifier?: string;
  billerCode?: string;
  billerName?: string;
  customerIdentifier?: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  dataPlanCode?: string;
  gateway: VTUPaymentGateway;
  networkProvider?: string;
  phoneNumber?: string;
  productCode?: string;
  provider?: 'kuda' | 'monnify';
  requireValidationRef?: boolean;
  type: 'airtime' | 'data' | 'electricity' | 'cable_tv' | 'betting';
  validationReference?: string;
  walletAmount?: number;
}
