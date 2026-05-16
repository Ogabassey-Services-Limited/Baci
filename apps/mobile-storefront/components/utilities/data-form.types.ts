export interface DataFormProps {
  onSuccess: (data: {
    reference: string;
    amount: number;
    customerIdentifier?: string;
    status?: 'processing' | 'successful';
    voucherPin?: string;
    cashback?: { amount: number; newBalance: number };
  }) => void;
  initialAmount?: string;
  initialPhoneNumber?: string;
  initialPlan?: string;
  initialProvider?: string;
  isRepeatPaymentReady?: boolean;
}
