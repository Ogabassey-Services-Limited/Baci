import type {
  BankFormInput,
  MerchantBankFormInitialData,
} from './merchant-bank-form-types';

export function getMerchantBankFormDefaultValues(
  initialData: MerchantBankFormInitialData | undefined,
  isManualBankDetails: boolean
): BankFormInput {
  return {
    accountNumber: initialData?.accountNumber || '',
    bankCode: initialData?.bankCode || '',
    bankName: isManualBankDetails ? initialData?.bankName || '' : '',
    accountName: initialData?.accountName || initialData?.businessName || '',
    businessName: initialData?.businessName || '',
    autoPayoutEnabled: initialData?.autoPayoutEnabled,
    manualBankDetails: isManualBankDetails,
  };
}
