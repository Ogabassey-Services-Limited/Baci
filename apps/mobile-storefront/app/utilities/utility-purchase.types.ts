import { z } from 'zod';

export interface CashbackInfo {
  amount: number;
  newBalance: number;
}

/**
 * Utility purchase lifecycle state.
 *
 * `failed` means the external provider rejected or declined the transaction.
 * `error` means an internal/system problem prevented completion.
 */
export type UtilityPurchaseStatus =
  | 'processing'
  | 'successful'
  | 'failed'
  | 'error'
  | 'cancelled';

export interface UtilityPurchaseResult {
  reference: string;
  amount: number;
  customerIdentifier?: string;
  cashback?: CashbackInfo;
  status?: UtilityPurchaseStatus;
  voucherPin?: string;
}

export const VALID_UTILITY_TYPES = [
  'airtime',
  'data',
  'tv',
  'power',
  'gaming',
] as const;

export type ValidUtilityType = (typeof VALID_UTILITY_TYPES)[number];

export interface RouteRepeatParams {
  repeatAmount?: string;
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatDataPlanCode?: string;
  repeatNetworkProvider?: string;
  repeatPhoneNumber?: string;
  repeatVerified?: string;
}

export const RouteRepeatParamsSchema = z.object({
  repeatAmount: z.string().optional(),
  repeatBillerName: z.string().optional(),
  repeatBillItemIdentifier: z.string().optional(),
  repeatCustomerIdentifier: z.string().optional(),
  repeatDataPlanCode: z.string().optional(),
  repeatNetworkProvider: z.string().optional(),
  repeatPhoneNumber: z.string().optional(),
  repeatVerified: z.string().optional(),
});
