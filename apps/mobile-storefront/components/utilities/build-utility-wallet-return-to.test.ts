import { describe, expect, it } from '@jest/globals';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';
import { buildUtilityWalletReturnTo } from './build-utility-wallet-return-to';

describe('buildUtilityWalletReturnTo', () => {
  it('builds an airtime deep-link with amount, phone and network in a stable order', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 1000,
      networkProvider: 'MTN',
      phoneNumber: '08012345678',
      type: 'airtime',
    });

    expect(href).toBe(
      '/utilities/airtime?repeatAmount=1000&repeatPhoneNumber=08012345678&repeatNetworkProvider=MTN'
    );
  });

  it('omits missing and blank fields', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 0,
      networkProvider: '   ',
      phoneNumber: '08012345678',
      type: 'airtime',
    });

    expect(href).toBe('/utilities/airtime?repeatPhoneNumber=08012345678');
  });

  it('encodes each value exactly once so separators cannot break parsing', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 2500,
      phoneNumber: '+2348012345678',
      type: 'airtime',
    });

    expect(href).toBe(
      '/utilities/airtime?repeatAmount=2500&repeatPhoneNumber=%2B2348012345678'
    );
  });

  it('returns a path without a query when nothing is provided', () => {
    expect(buildUtilityWalletReturnTo({ type: 'data' })).toBe(
      '/utilities/data'
    );
  });

  it('survives the wallet return-to sanitizer (singly-encoded round-trip)', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 1000,
      dataPlanCode: 'PLAN_1GB',
      networkProvider: 'MTN',
      phoneNumber: '+2348012345678',
      type: 'data',
    });

    expect(sanitizeWalletReturnTo(href)).toBe(href);
  });

  it('includes the verified flag as 1 when verified', () => {
    const href = buildUtilityWalletReturnTo({
      customerIdentifier: '1234567890',
      type: 'power',
      verified: true,
    });

    expect(href).toBe(
      '/utilities/power?repeatCustomerIdentifier=1234567890&repeatVerified=1'
    );
  });
});
