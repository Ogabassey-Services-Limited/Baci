import type { NetworkProviderId } from '@/constants/network-providers';

/** Whole-naira amount parsed from the formatted form input before submission. */
export type AirtimeAmount = number;

/**
 * Cashback awarded by an airtime/top-up success response. Values are numeric
 * naira amounts as numbers, not formatted strings; the presentation layer
 * formats them for display.
 */
export interface Cashback {
  /** Numeric naira cashback amount credited for this purchase. */
  amount: number;
  /** Numeric naira wallet balance after the cashback credit is applied. */
  newBalance: number;
}

export interface AirtimePurchaseSuccessData {
  reference: string;
  amount: AirtimeAmount;
  customerIdentifier?: string;
  status?: 'processing' | 'successful';
  voucherPin?: string;
  cashback?: Cashback;
}

export interface AirtimeFormProps {
  onSuccess: (data: AirtimePurchaseSuccessData) => void;
  /**
   * Form input string. Convert to a numeric AirtimeAmount in
   * useAirtimeFormController before constructing success data.
   */
  initialAmount?: string;
  initialPhoneNumber?: string;
  initialProvider?: NetworkProviderId;
  isRepeatPaymentReady?: boolean;
}
