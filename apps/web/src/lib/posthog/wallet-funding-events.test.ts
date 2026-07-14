import { describe, expect, it } from 'vitest';
import type { CustomerWalletPaymentAccountErrorCode } from '@/lib/customer-wallet-payment-account-types';
import { WALLET_FUNDING_TELEMETRY } from './wallet-funding-events';

describe('WALLET_FUNDING_TELEMETRY', () => {
  it('exposes the six funnel event names', () => {
    expect(WALLET_FUNDING_TELEMETRY.events).toEqual({
      surfaceOpened: 'wallet_funding_surface_opened',
      createAttempted: 'wallet_funding_account_create_attempted',
      accountCreated: 'wallet_funding_account_created',
      createFailed: 'wallet_funding_account_create_failed',
      paymentMethodSelected: 'utility_payment_method_selected',
      transferCredited: 'wallet_funding_transfer_credited',
    });
  });

  it('exposes both funding surfaces', () => {
    expect(WALLET_FUNDING_TELEMETRY.surfaces).toEqual({
      utilityModal: 'utility_modal',
      walletPage: 'wallet_page',
    });
  });

  it('maps known API failure codes 1:1 and keeps the synthetic buckets', () => {
    expect(WALLET_FUNDING_TELEMETRY.reasons).toEqual({
      customerPhoneRequired: 'CUSTOMER_PHONE_REQUIRED',
      gatewayNotConfigured: 'GATEWAY_NOT_CONFIGURED',
      paystackCustomerError: 'PAYSTACK_CUSTOMER_ERROR',
      paystackDvaError: 'PAYSTACK_DVA_ERROR',
      orderAliasConflict: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
      receiverConflict: 'WALLET_DVA_RECEIVER_CONFLICT',
      storageError: 'WALLET_DVA_STORAGE_ERROR',
      subaccountConflict: 'WALLET_DVA_SUBACCOUNT_CONFLICT',
      dvaDisabled: 'WALLET_DVA_DISABLED',
      network: 'network',
      other: 'other',
    });
  });

  it('carries every CustomerWalletPaymentAccountErrorCode member', () => {
    // Mirrors the union in `@/lib/customer-wallet-payment-account-types`. A new
    // member there without an entry above already fails `tsc` via the in-file
    // drift guard; this keeps the failure legible at test time too.
    const apiErrorCodes: CustomerWalletPaymentAccountErrorCode[] = [
      'CUSTOMER_PHONE_REQUIRED',
      'GATEWAY_NOT_CONFIGURED',
      'PAYSTACK_CUSTOMER_ERROR',
      'PAYSTACK_DVA_ERROR',
      'WALLET_DVA_ORDER_ALIAS_CONFLICT',
      'WALLET_DVA_RECEIVER_CONFLICT',
      'WALLET_DVA_SUBACCOUNT_CONFLICT',
      'WALLET_DVA_STORAGE_ERROR',
    ];
    const reasons = new Set<string>(
      Object.values(WALLET_FUNDING_TELEMETRY.reasons)
    );

    expect(apiErrorCodes.filter((code) => !reasons.has(code))).toEqual([]);
  });
});
