import { describe, expect, it } from '@jest/globals';
import type { PaymentSettings } from '@/hooks/useMerchantPaymentSettings';
import { useWalletFundingAccountAvailability } from './useWalletFundingAccountAvailability';
import { WALLET_FUNDING_ACCOUNT_MESSAGES } from './wallet-funding-account.constants';

const enabledPaymentSettings = {
  wallet_paystack_dva_enabled: true,
} as PaymentSettings;

describe('useWalletFundingAccountAvailability', () => {
  it('allows account creation when DVA is enabled and the customer has a phone number', () => {
    const availability = useWalletFundingAccountAvailability({
      customerPhone: ' 08012345678 ',
      isPaymentSettingsError: false,
      isPaymentSettingsPending: false,
      paymentSettings: enabledPaymentSettings,
    });

    expect(availability).toMatchObject({
      canCreateFundingAccount: true,
      customerPhone: '08012345678',
      isPaymentSettingsPending: false,
      walletDvaEnabled: true,
    });
    expect(availability.createFundingAccountUnavailableMessage).toBeUndefined();
  });

  it('reports pending availability while payment settings are unresolved', () => {
    const availability = useWalletFundingAccountAvailability({
      customerPhone: '08012345678',
      isPaymentSettingsError: false,
      isPaymentSettingsPending: true,
      paymentSettings: undefined,
    });

    expect(availability.canCreateFundingAccount).toBe(false);
    expect(availability.createFundingAccountUnavailableMessage).toBe(
      WALLET_FUNDING_ACCOUNT_MESSAGES.AVAILABILITY_CHECKING
    );
  });

  it('requires DVA to be enabled and a customer phone number to be present', () => {
    expect(
      useWalletFundingAccountAvailability({
        customerPhone: '08012345678',
        isPaymentSettingsError: false,
        isPaymentSettingsPending: false,
        paymentSettings: {
          ...enabledPaymentSettings,
          wallet_paystack_dva_enabled: false,
        },
      }).createFundingAccountUnavailableMessage
    ).toBe(WALLET_FUNDING_ACCOUNT_MESSAGES.DVA_DISABLED);

    expect(
      useWalletFundingAccountAvailability({
        customerPhone: ' ',
        isPaymentSettingsError: false,
        isPaymentSettingsPending: false,
        paymentSettings: enabledPaymentSettings,
      }).createFundingAccountUnavailableMessage
    ).toBe(WALLET_FUNDING_ACCOUNT_MESSAGES.PHONE_REQUIRED);
  });

  it('treats null payment settings as resolved with DVA disabled', () => {
    const availability = useWalletFundingAccountAvailability({
      customerPhone: '08012345678',
      isPaymentSettingsError: false,
      isPaymentSettingsPending: false,
      paymentSettings: null,
    });

    expect(availability).toMatchObject({
      canCreateFundingAccount: false,
      isPaymentSettingsPending: false,
      walletDvaEnabled: false,
    });
    expect(availability.createFundingAccountUnavailableMessage).toBe(
      WALLET_FUNDING_ACCOUNT_MESSAGES.DVA_DISABLED
    );
  });
});
