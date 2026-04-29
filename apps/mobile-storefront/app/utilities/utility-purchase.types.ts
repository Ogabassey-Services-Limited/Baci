export interface CashbackInfo {
  amount: number;
  newBalance: number;
}

export interface SuccessData {
  reference: string;
  amount: number;
  customerIdentifier?: string;
  cashback?: CashbackInfo;
  status?: 'processing' | 'successful';
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
