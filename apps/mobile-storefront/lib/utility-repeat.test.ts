import { jest } from '@jest/globals';

jest.mock('@/lib/logger', () => {
  const mockWarn = jest.fn();

  return {
    __mockLoggerWarn: mockWarn,
    createLogger: () => ({
      warn: mockWarn,
    }),
  };
});

import { utilityRepeatHelpers } from '@/lib/utility-repeat';

interface LoggerMockModule {
  __mockLoggerWarn: jest.Mock;
}

const { __mockLoggerWarn: mockLoggerWarn } = jest.requireMock(
  '@/lib/logger'
) as LoggerMockModule;

describe('utilityRepeatHelpers', () => {
  beforeEach(() => {
    mockLoggerWarn.mockClear();
  });

  it('maps utility history transactions into repeat route params', () => {
    const params = utilityRepeatHelpers.getRouteParams({
      id: 'tx-1',
      amount: 2500,
      biller_item_code: 'KUD-ELE-EKED-002',
      biller_name: 'EKEDC NG',
      created_at: '2026-04-28T12:00:00.000Z',
      customer_identifier: '43901766923',
      network_provider: null,
      request_reference: 'ref-123',
      status: 'successful',
      type: 'electricity',
    });

    expect(params).toEqual({
      repeatAmount: '2500',
      repeatBillerName: 'EKEDC NG',
      repeatBillItemIdentifier: 'KUD-ELE-EKED-002',
      repeatCustomerIdentifier: '43901766923',
      repeatVerified: '1',
      type: 'power',
    });
  });

  it('does not mark unsuccessful utility history rows as verified repeats', () => {
    const params = utilityRepeatHelpers.getRouteParams({
      id: 'tx-1',
      amount: 2500,
      biller_item_code: 'KUD-ELE-EKED-002',
      biller_name: 'EKEDC NG',
      created_at: '2026-04-28T12:00:00.000Z',
      customer_identifier: '43901766923',
      network_provider: null,
      request_reference: 'ref-123',
      status: 'failed',
      type: 'electricity',
    });

    expect(params).not.toHaveProperty('repeatVerified');
  });

  it('does not stringify a NaN history amount into route params', () => {
    const params = utilityRepeatHelpers.getRouteParams({
      id: 'tx-nan',
      amount: Number.NaN,
      created_at: '2026-04-28T12:00:00.000Z',
      network_provider: null,
      request_reference: 'ref-nan',
      status: 'successful',
      type: 'airtime',
    });

    expect(params).not.toHaveProperty('repeatAmount');
  });

  it('normalizes Kuda telco provider names for mobile repeat forms', () => {
    const defaults = utilityRepeatHelpers.getDefaults({
      id: 'tx-2',
      amount: 1000,
      created_at: '2026-04-28T12:00:00.000Z',
      network_provider: '9MOBILE',
      phone_number: '08091234567',
      repeat_data_plan_code: 'KUD-DATA-001',
      request_reference: 'ref-456',
      status: 'successful',
      type: 'data',
    });

    expect(defaults).toMatchObject({
      amount: '1000',
      dataPlanCode: 'KUD-DATA-001',
      networkProvider: 't2',
      phoneNumber: '08091234567',
    });
  });

  it('preserves already-normalized mobile provider slugs for repeats', () => {
    const defaults = utilityRepeatHelpers.getDefaults({
      id: 'tx-3',
      amount: 1000,
      created_at: '2026-04-28T12:00:00.000Z',
      network_provider: 't2',
      phone_number: '08091234567',
      request_reference: 'ref-789',
      status: 'successful',
      type: 'airtime',
    });

    expect(defaults.networkProvider).toBe('t2');
  });

  it('falls back to a slug and logs when repeat provider is unknown', () => {
    const defaults = utilityRepeatHelpers.getDefaults({
      id: 'tx-4',
      amount: 1000,
      created_at: '2026-04-28T12:00:00.000Z',
      network_provider: 'My Telco',
      phone_number: '08091234567',
      request_reference: 'ref-999',
      status: 'successful',
      type: 'airtime',
    });

    expect(defaults.networkProvider).toBe('my-telco');
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Unknown repeat provider received',
      {
        fallbackProvider: 'my-telco',
        networkProvider: 'My Telco',
      }
    );
  });

  it('throws a clear error when a repeat route type mapping is missing', () => {
    expect(() =>
      utilityRepeatHelpers.getRouteType(
        'unknown-type' as Parameters<typeof utilityRepeatHelpers.getRouteType>[0]
      )
    ).toThrow('Unsupported utility history transaction type: unknown-type');
  });
});
