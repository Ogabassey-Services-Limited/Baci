import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import type { Biller } from '@/hooks/use-vtu-billers';
import type { BillFormProps } from './bill-form.types';

export type PaymentState = ReturnType<typeof useUtilityPayment>;

interface BillCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CreateBillFormPurchaseHandlerInput {
  amount: string;
  billType: 'electricity' | 'cable_tv' | 'betting';
  canShowPayment: boolean;
  customer: BillCustomer | null | undefined;
  customerId: string;
  dismissKeyboard: () => void;
  getIsSubmitting: () => boolean;
  numericAmount: number;
  onSuccess: BillFormProps['onSuccess'];
  payment: PaymentState;
  selectedBiller: Biller | null;
  selectedBillItemIdentifier: string | null;
  selectedBillItemPathLabel: string;
  setIsSubmitting: (isSubmitting: boolean) => void;
  type: BillFormProps['type'];
  /**
   * Verified bill customer-of-record name (meter owner / account holder)
   * from the verify step or a previous successful purchase. When present,
   * sent as the API payload's `customerName` so the row's `customer_name`
   * column reflects the bill recipient, not the buyer.
   */
  verifiedCustomerName: string | null;
}
