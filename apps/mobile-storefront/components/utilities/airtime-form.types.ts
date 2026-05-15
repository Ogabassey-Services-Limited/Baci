import type { NetworkProviderId } from '@/constants/network-providers';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';

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

/**
 * Payload emitted after an airtime purchase reaches a successful or processing
 * terminal screen. Raw values are kept unformatted so receipt and success UI can
 * apply locale-specific presentation; sensitive fields must be masked before
 * logs, analytics, or generic serialization.
 */
export interface AirtimePurchaseSuccessData {
  /** Gateway or VTU transaction reference used for support and receipt sharing. */
  reference: string;
  /** Whole-naira amount charged or confirmed for the airtime purchase. */
  amount: AirtimeAmount;
  /** Sensitive customer phone/account identifier. Mask before logging or analytics. */
  customerIdentifier?: string;
  /** Final or interim payment status returned by the VTU purchase flow. */
  status?: 'processing' | 'successful';
  /**
   * Sensitive voucher/token data. Do not log, persist in plaintext, or include
   * in generic serializations.
   */
  voucherPin?: string;
  /** Optional cashback credit returned after a successful purchase. */
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
  recentRecipients?: UtilityRepeatRecipient[];
  onSelectRecentRecipient?: (recipient: UtilityRepeatRecipient) => void;
}
