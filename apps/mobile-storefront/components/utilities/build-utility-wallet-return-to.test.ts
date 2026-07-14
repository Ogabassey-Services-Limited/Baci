import { describe, expect, it } from '@jest/globals';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';
import { RouteRepeatParamsSchema } from '@/schemas/utility-purchase';
import { buildUtilityWalletReturnTo } from './build-utility-wallet-return-to';

/** Mirrors how `/utilities/[type]` reads the query back off the deep-link. */
function toRepeatParams(href: string): Record<string, string> {
  const query = href.split('?')[1] ?? '';
  if (query === '') {
    return {};
  }
  return Object.fromEntries(
    query.split('&').map((pair) => {
      const [key, value] = pair.split('=');
      return [key, decodeURIComponent(value ?? '')];
    })
  );
}

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

  it('omits a half-typed phone so the other repeat params still round-trip', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 1000,
      networkProvider: 'MTN',
      phoneNumber: '0801',
      type: 'airtime',
    });

    expect(href).toBe(
      '/utilities/airtime?repeatAmount=1000&repeatNetworkProvider=MTN'
    );
    expect(
      RouteRepeatParamsSchema.safeParse(toRepeatParams(href)).success
    ).toBe(true);
  });

  it('keeps every repeat param parseable by the route schema (valid phone)', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 1500,
      dataPlanCode: 'PLAN_1GB',
      networkProvider: 'mtn',
      phoneNumber: '08012345678',
      type: 'data',
    });

    const result = RouteRepeatParamsSchema.safeParse(toRepeatParams(href));

    expect(result.success).toBe(true);
    expect(result.success && result.data.repeatPhoneNumber).toBe('08012345678');
    expect(result.success && result.data.repeatAmount).toBe(1500);
  });

  it('survives the sanitizer when a bill field contains a slash', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 5000,
      billerName: 'DSTV/GOTV',
      customerAddress: 'Flat 1/2, Adeola Odeku',
      customerIdentifier: '1234567890',
      type: 'tv',
    });

    expect(sanitizeWalletReturnTo(href)).toBe(href);
    expect(toRepeatParams(href).repeatCustomerAddress).toBe(
      'Flat 1/2, Adeola Odeku'
    );
    expect(toRepeatParams(href).repeatBillerName).toBe('DSTV/GOTV');
  });

  it('survives the sanitizer when a bill field contains a backslash', () => {
    const href = buildUtilityWalletReturnTo({
      amount: 5000,
      customerAddress: 'Block A\\Flat 3',
      customerIdentifier: '1234567890',
      type: 'power',
    });

    expect(sanitizeWalletReturnTo(href)).toBe(href);
    expect(toRepeatParams(href).repeatCustomerAddress).toBe('Block A\\Flat 3');
  });
});
