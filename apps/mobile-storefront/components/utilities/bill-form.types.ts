import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';

export type BillFormStatus =
  | 'processing'
  | 'successful'
  | 'failed'
  | 'error'
  | 'cancelled';

export interface Cashback {
  readonly amount: number;
  readonly newBalance: number;
}

export interface BillFormResultData {
  readonly reference: string;
  readonly amount: number;
  /**
   * customerIdentifier can contain sensitive PII such as phone, account, or
   * meter identifiers. Avoid logging it raw, and mask it before telemetry.
   */
  readonly customerIdentifier?: string;
  readonly status?: BillFormStatus;
  /**
   * Sensitive voucher/token data. Do not log, persist in plaintext, or include
   * in generic serializations.
   */
  readonly voucherPin?: string;
  readonly cashback?: Cashback;
  /**
   * Verified meter/customer address (electricity), so the immediate in-app
   * receipt can show it without waiting for a history reload.
   */
  readonly address?: string | null;
}

export interface BillFormProps {
  type: 'tv' | 'power' | 'gaming';
  onSuccess: (data: BillFormResultData) => void;
  initialAmount?: string;
  initialBillerName?: string;
  initialBillItemIdentifier?: string;
  /**
   * Sensitive PII such as a meter number, smart card number, or betting
   * account identifier. Mask before logging or analytics.
   */
  initialCustomerIdentifier?: string;
  /**
   * Verified customer-of-record name from the previous successful purchase
   * (e.g. the meter owner). Used only to surface a confirmation label when the
   * verified state is restored from history.
   */
  initialCustomerName?: string;
  /**
   * Verified meter address from the previous successful purchase. Seeds the
   * verified-address state so a repeated bill re-attaches the meter address.
   */
  initialCustomerAddress?: string;
  isRepeatPaymentReady?: boolean;
  recentRecipients?: UtilityRepeatRecipient[];
  onSelectRecentRecipient?: (recipient: UtilityRepeatRecipient) => void;
}
