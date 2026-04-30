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
  isRepeatPaymentReady?: boolean;
}
