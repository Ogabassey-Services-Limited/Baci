export interface BillFormSuccessData {
  reference: string;
  amount: number;
  customerIdentifier?: string;
  status?: 'processing' | 'successful';
  voucherPin?: string;
  cashback?: { amount: number; newBalance: number };
}

export interface BillFormProps {
  type: 'tv' | 'power' | 'gaming';
  onSuccess: (data: BillFormSuccessData) => void;
  initialAmount?: string;
  initialBillerName?: string;
  initialBillItemIdentifier?: string;
  initialCustomerIdentifier?: string;
  isRepeatPaymentReady?: boolean;
}
