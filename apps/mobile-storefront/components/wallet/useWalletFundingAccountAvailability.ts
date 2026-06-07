import type { PaymentSettings } from '@/hooks/useMerchantPaymentSettings';
import { WALLET_FUNDING_ACCOUNT_MESSAGES } from './wallet-funding-account.constants';

interface UseWalletFundingAccountAvailabilityParams {
  customerPhone?: string | null;
  isPaymentSettingsError: boolean;
  isPaymentSettingsPending: boolean;
  paymentSettings?: PaymentSettings | null;
}

export interface WalletFundingAccountAvailability {
  canCreateFundingAccount: boolean;
  createFundingAccountUnavailableMessage?: string;
  customerPhone: string;
  isPaymentSettingsPending: boolean;
  walletDvaEnabled: boolean;
}

export function useWalletFundingAccountAvailability({
  customerPhone,
  isPaymentSettingsError,
  isPaymentSettingsPending,
  paymentSettings,
}: UseWalletFundingAccountAvailabilityParams): WalletFundingAccountAvailability {
  const walletDvaEnabled =
    paymentSettings?.wallet_paystack_dva_enabled === true;
  const normalizedCustomerPhone = customerPhone?.trim() ?? '';
  let createFundingAccountUnavailableMessage: string | undefined;

  if (isPaymentSettingsPending) {
    createFundingAccountUnavailableMessage =
      WALLET_FUNDING_ACCOUNT_MESSAGES.AVAILABILITY_CHECKING;
  } else if (isPaymentSettingsError) {
    createFundingAccountUnavailableMessage =
      WALLET_FUNDING_ACCOUNT_MESSAGES.AVAILABILITY_ERROR;
  } else if (!walletDvaEnabled) {
    createFundingAccountUnavailableMessage =
      WALLET_FUNDING_ACCOUNT_MESSAGES.DVA_DISABLED;
  } else if (!normalizedCustomerPhone) {
    createFundingAccountUnavailableMessage =
      WALLET_FUNDING_ACCOUNT_MESSAGES.PHONE_REQUIRED;
  }

  return {
    canCreateFundingAccount: !createFundingAccountUnavailableMessage,
    createFundingAccountUnavailableMessage,
    customerPhone: normalizedCustomerPhone,
    isPaymentSettingsPending,
    walletDvaEnabled,
  };
}
