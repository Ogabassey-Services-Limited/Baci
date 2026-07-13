import { describe, expect, it } from 'vitest';
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
      orderAliasConflict: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
      customerPhoneRequired: 'CUSTOMER_PHONE_REQUIRED',
      dvaDisabled: 'WALLET_DVA_DISABLED',
      network: 'network',
      other: 'other',
    });
  });
});
