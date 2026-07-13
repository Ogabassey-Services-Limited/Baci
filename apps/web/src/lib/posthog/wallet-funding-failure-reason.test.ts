import { describe, expect, it } from 'vitest';
import { resolveWalletFundingFailureReason } from './wallet-funding-failure-reason';

describe('resolveWalletFundingFailureReason', () => {
  it.each([
    'WALLET_DVA_ORDER_ALIAS_CONFLICT',
    'CUSTOMER_PHONE_REQUIRED',
    'WALLET_DVA_DISABLED',
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
});
