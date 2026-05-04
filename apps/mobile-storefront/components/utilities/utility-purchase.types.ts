/**
 * Cashback credit granted to the customer after a qualifying utility purchase.
 */
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

/**
 * Normalized result returned to the utility purchase flow after checkout or
 * payment reconciliation.
 */
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

interface BaseRouteRepeatParams {
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatCustomerName?: string;
  repeatDataPlanCode?: string;
  repeatNetworkProvider?: string;
  repeatPhoneNumber?: string;
}

export interface RawRouteRepeatParams extends BaseRouteRepeatParams {
  repeatAmount?: string;
  repeatVerified?: boolean | number | string;
}

export interface RouteRepeatParams extends BaseRouteRepeatParams {
  repeatAmount?: number;
  repeatVerified?: boolean;
}
