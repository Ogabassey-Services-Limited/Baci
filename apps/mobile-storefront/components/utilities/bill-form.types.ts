export type BillFormStatus =
  | 'processing'
  | 'successful'
  | 'failed'
  | 'error'
  | 'cancelled';

export interface BillFormResultData {
  reference: string;
  amount: number;
  /**
   * customerIdentifier can contain sensitive PII such as phone, account, or
   * meter identifiers. Avoid logging it raw, and mask it before telemetry.
   */
  customerIdentifier?: string;
  status?: BillFormStatus;
  /**
   * Sensitive voucher/token data. Do not log, persist in plaintext, or include
   * in generic serializations.
   */
  voucherPin?: string;
  cashback?: { amount: number; newBalance: number };
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
