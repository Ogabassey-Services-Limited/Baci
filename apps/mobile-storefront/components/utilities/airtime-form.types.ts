import type { NetworkProviderId } from '@/constants/network-providers';

/** Whole-naira amount parsed from the formatted form input before submission. */
export type AirtimeAmount = number;

export interface Cashback {
  amount: number;
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
