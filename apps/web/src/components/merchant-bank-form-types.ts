import type {
  MerchantBankFormInput,
  MerchantBankFormValues,
} from '@/schemas/merchant-bank';

export type BankFormInput = MerchantBankFormInput;
export type BankFormValues = MerchantBankFormValues;

export interface MerchantBankFormInitialData {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  bankCode?: string;
  businessName?: string;
  autoPayoutEnabled?: boolean;
}

export interface MerchantBankFormSavedValues {
  accountName?: string;
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  businessName: string;
  merchantId: string;
}

export interface MerchantBankFormProps {
  merchantId: string;
  countryCode?: string | null;
  initialData?: MerchantBankFormInitialData;
  onSuccess?: (savedBank: MerchantBankFormSavedValues) => void;
}

export interface SaveBankPayload {
  merchantId: string;
  accountNumber: string;
  bankCode?: string;
  bank_name?: string;
  account_name?: string;
  businessName: string;
  autoPayoutEnabled?: boolean;
}
