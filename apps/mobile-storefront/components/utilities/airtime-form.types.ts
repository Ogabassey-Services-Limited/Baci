export interface AirtimePurchaseSuccessData {
  reference: string;
  amount: number;
  customerIdentifier?: string;
  status?: 'processing' | 'successful';
  voucherPin?: string;
  cashback?: { amount: number; newBalance: number };
}

export interface AirtimeFormProps {
  onSuccess: (data: AirtimePurchaseSuccessData) => void;
  initialAmount?: string;
  initialPhoneNumber?: string;
  initialProvider?: string;
  isRepeatPaymentReady?: boolean;
}
