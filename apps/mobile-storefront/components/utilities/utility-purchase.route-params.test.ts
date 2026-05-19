import {
  getNetworkProviderId,
  getParamSuccessData,
  toUtilityRouteParams,
  type UtilityRouteParams,
} from './utility-purchase.route-params';

describe('toUtilityRouteParams', () => {
  it('normalizes array query params to their first value', () => {
    // Arrange
    const input = {
      type: ['airtime'],
      amount: ['5000'],
      paymentStatus: ['successful'],
      reference: ['txn-123'],
    };

    // Act
    const params = toUtilityRouteParams(input);

    // Assert
    expect(params.type).toBe('airtime');
    expect(params.amount).toBe('5000');
    expect(params.paymentStatus).toBe('successful');
    expect(params.reference).toBe('txn-123');
  });

  it('accepts scalar values and preserves supported keys', () => {
    // Arrange
    const input = {
      type: 'data',
      repeatNetworkProvider: 'mtn',
      repeatPhoneNumber: '08012345678',
      repeatVerified: 'true',
    };

    // Act
    const params = toUtilityRouteParams(input);

    // Assert
    expect(params.type).toBe('data');
    expect(params.repeatNetworkProvider).toBe('mtn');
    expect(params.repeatPhoneNumber).toBe('08012345678');
    expect(params.repeatVerified).toBe('true');
  });

  it('falls back when params are missing or empty arrays', () => {
    // Arrange
    const input = {
      type: [],
      amount: undefined,
      paymentStatus: [],
    };

    // Act
    const params = toUtilityRouteParams(input);

    // Assert
    expect(params.type).toBe('');
    expect(params.amount).toBeUndefined();
    expect(params.paymentStatus).toBeUndefined();
  });
});

describe('getParamSuccessData', () => {
  it('returns normalized success payload for successful status', () => {
    // Arrange
    const params = {
      type: 'airtime',
      paymentStatus: 'successful',
      reference: 'ref-001',
      amount: '2500.50',
      cashbackAmount: '50',
      cashbackNewBalance: '1500',
      customerIdentifier: '08012345678',
      voucherPin: '1122',
    } satisfies UtilityRouteParams;

    // Act
    const data = getParamSuccessData(params);

    // Assert
    expect(data).toEqual({
      amount: 2500.5,
      cashback: { amount: 50, newBalance: 1500 },
      customerIdentifier: '08012345678',
      reference: 'ref-001',
      status: 'successful',
      voucherPin: '1122',
    });
  });

  it('returns null for unsupported status, missing status, or missing reference', () => {
    // Arrange
    const unsupportedStatus = {
      type: 'data',
      paymentStatus: 'failed',
      reference: 'ref-002',
    } satisfies UtilityRouteParams;

    const missingStatus = {
      type: 'data',
      reference: 'ref-003',
    } satisfies UtilityRouteParams;

    const missingReference = {
      type: 'data',
      paymentStatus: 'successful',
    } satisfies UtilityRouteParams;

    // Act & Assert
    expect(getParamSuccessData(unsupportedStatus)).toBeNull();
    expect(getParamSuccessData(missingStatus)).toBeNull();
    expect(getParamSuccessData(missingReference)).toBeNull();
  });

  it('uses numeric fallbacks and ignores partial cashback payloads', () => {
    // Arrange
    const params = {
      type: 'airtime',
      paymentStatus: 'processing',
      reference: 'ref-004',
      amount: 'not-a-number',
      cashbackAmount: '10',
    } satisfies UtilityRouteParams;

    // Act
    const data = getParamSuccessData(params);

    // Assert
    expect(data).toEqual({
      amount: 0,
      cashback: undefined,
      customerIdentifier: undefined,
      reference: 'ref-004',
      status: 'processing',
      voucherPin: null,
    });
  });
});

describe('getNetworkProviderId', () => {
  it('returns the provider id only when it exactly exists in the configured list', () => {
    // Arrange
    const validProvider = 'mtn';
    const invalidProvider = 'unknown-provider';
    const uppercaseProvider = 'MTN';
    const paddedProvider = ' mtn ';

    // Act
    const valid = getNetworkProviderId(validProvider);
    const invalid = getNetworkProviderId(invalidProvider);
    const uppercase = getNetworkProviderId(uppercaseProvider);
    const padded = getNetworkProviderId(paddedProvider);
    const empty = getNetworkProviderId('');
    const missing = getNetworkProviderId(undefined);

    // Assert
    expect(valid).toBe('mtn');
    expect(invalid).toBeUndefined();
    expect(uppercase).toBeUndefined();
    expect(padded).toBeUndefined();
    expect(empty).toBeUndefined();
    expect(missing).toBeUndefined();
  });
});
