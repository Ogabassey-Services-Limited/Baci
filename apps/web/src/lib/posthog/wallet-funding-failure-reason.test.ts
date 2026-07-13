import { describe, expect, it } from 'vitest';
import { resolveWalletFundingFailureReason } from './wallet-funding-failure-reason';

describe('resolveWalletFundingFailureReason', () => {
  it.each([
    'WALLET_DVA_ORDER_ALIAS_CONFLICT',
    'CUSTOMER_PHONE_REQUIRED',
    'WALLET_DVA_DISABLED',
    'GATEWAY_NOT_CONFIGURED',
    'WALLET_DVA_SUBACCOUNT_CONFLICT',
    'PAYSTACK_CUSTOMER_ERROR',
    'PAYSTACK_DVA_ERROR',
  ])('passes through the known server code %s', (code) => {
    expect(resolveWalletFundingFailureReason(code)).toBe(code);
  });

  it.each([
    undefined,
    null,
    '',
    'SOMETHING_UNEXPECTED',
    42,
    {},
  ])('collapses an unrecognized code (%s) to other', (code) => {
    expect(resolveWalletFundingFailureReason(code)).toBe('other');
  });

  it.each(['network', 'other'])(
    'never treats the synthetic bucket %s as a server code pass-through source',
    (bucket) => {
      // They resolve to `other` when arriving as an API code — the caller sets
      // `network` itself for transport failures.
      expect(resolveWalletFundingFailureReason(bucket)).toBe('other');
    }
  );
});
