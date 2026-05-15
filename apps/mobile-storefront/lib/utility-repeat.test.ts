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
      customer_name: 'Jane Customer',
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
      repeatCustomerName: 'Jane Customer',
      repeatVerified: '1',
      type: 'power',
    });
  });

  it('omits the repeat customer name when the history row lacks one', () => {
    const params = utilityRepeatHelpers.getRouteParams({
      id: 'tx-no-name',
      amount: 2500,
      biller_item_code: 'KUD-ELE-EKED-002',
      biller_name: 'EKEDC NG',
      created_at: '2026-04-28T12:00:00.000Z',
      customer_identifier: '43901766923',
      customer_name: null,
      network_provider: null,
      request_reference: 'ref-no-name',
      status: 'successful',
      type: 'electricity',
    });

    expect(params).not.toHaveProperty('repeatCustomerName');
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
        'unknown-type' as Parameters<
          typeof utilityRepeatHelpers.getRouteType
        >[0]
      )
    ).toThrow('Unsupported utility history transaction type: unknown-type');
  });

  describe('getRecentRecipients', () => {
    const baseTransaction = {
      id: 'txn-1',
      amount: 2500,
      created_at: '2026-05-09T10:00:00.000Z',
      customer_cashback: null,
      error_message: null,
      payment_gateway: 'paystack' as const,
      payment_reference: 'pay-1',
      payment_status: 'completed' as const,
      request_reference: 'ref-1',
      status: 'successful' as const,
      voucher_pin: null,
    };

    it('maps successful power transactions into customer-friendly recipient rows', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            type: 'electricity' as const,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766923',
            customer_name: 'OLUROTIMI OLADIMEJI ADEBANJO',
            network_provider: null,
            phone_number: null,
            repeat_data_plan_code: null,
          },
        ],
        'power'
      );

      expect(recipients).toEqual([
        {
          id: 'txn-1',
          title: 'OLUROTIMI OLADIMEJI ADEBANJO',
          identifierLabel: 'Meter Number',
          identifier: '43901766923',
          meta: '₦2,500',
          defaults: {
            amount: '2500',
            billerName: 'EKEDC NG',
            billItemIdentifier: 'KUD-ELE-EKED-002',
            customerIdentifier: '43901766923',
            customerName: 'OLUROTIMI OLADIMEJI ADEBANJO',
            isVerified: true,
          },
        },
      ]);
    });

    it('uses the bill customer identifier instead of the buyer phone for bill recipients', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            type: 'electricity' as const,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766923',
            customer_name: 'OLUROTIMI OLADIMEJI ADEBANJO',
            network_provider: null,
            phone_number: '08146978921',
            repeat_data_plan_code: null,
          },
        ],
        'power'
      );

      expect(recipients[0]).toEqual(
        expect.objectContaining({
          identifier: '43901766923',
          identifierLabel: 'Meter Number',
          defaults: expect.objectContaining({
            customerIdentifier: '43901766923',
            phoneNumber: '08146978921',
          }),
        })
      );
    });

    it('ignores failed transactions and mismatched utility types', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            id: 'failed',
            type: 'electricity' as const,
            status: 'failed' as const,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766923',
            customer_name: 'Jane Customer',
            network_provider: null,
            phone_number: null,
            repeat_data_plan_code: null,
          },
          {
            ...baseTransaction,
            id: 'airtime-row',
            type: 'airtime' as const,
            biller_name: null,
            biller_item_code: null,
            customer_identifier: null,
            customer_name: null,
            network_provider: 'MTN',
            phone_number: '08012345678',
            repeat_data_plan_code: null,
          },
        ],
        'power'
      );

      expect(recipients).toEqual([]);
    });

    it('deduplicates identical recipients by first occurrence', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            id: 'newest',
            type: 'electricity' as const,
            amount: 2500,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766923',
            customer_name: 'First Customer',
            network_provider: null,
            phone_number: null,
            repeat_data_plan_code: null,
          },
          {
            ...baseTransaction,
            id: 'older',
            type: 'electricity' as const,
            amount: 1000,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766923',
            customer_name: 'Older Customer',
            network_provider: null,
            phone_number: null,
            repeat_data_plan_code: null,
          },
        ],
        'power'
      );

      // "Newest" is implied by the history hook sort order; this helper keeps
      // the first matching row it receives.
      expect(recipients).toHaveLength(1);
      expect(recipients[0]?.id).toBe('newest');
      expect(recipients[0]?.meta).toBe('₦2,500');
    });

    it('caps the recipient list at ten rows', () => {
      const transactions = Array.from({ length: 12 }, (_, index) => ({
        ...baseTransaction,
        id: `airtime-${index}`,
        type: 'airtime' as const,
        biller_name: null,
        biller_item_code: null,
        customer_identifier: null,
        customer_name: null,
        network_provider: 'MTN',
        phone_number: `080123456${index}`,
        repeat_data_plan_code: null,
      }));

      const recipients = utilityRepeatHelpers.getRecentRecipients(
        transactions,
        'airtime'
      );

      expect(recipients).toHaveLength(10);
    });

    it('keeps separate data plans for the same phone number', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            id: 'plan-1',
            type: 'data' as const,
            biller_name: null,
            biller_item_code: null,
            customer_identifier: null,
            customer_name: null,
            network_provider: 'MTN',
            phone_number: '08012345678',
            repeat_data_plan_code: 'MTN-2GB',
          },
          {
            ...baseTransaction,
            id: 'plan-2',
            type: 'data' as const,
            biller_name: null,
            biller_item_code: null,
            customer_identifier: null,
            customer_name: null,
            network_provider: 'MTN',
            phone_number: '08012345678',
            repeat_data_plan_code: 'MTN-5GB',
          },
        ],
        'data'
      );

      expect(recipients).toHaveLength(2);
      expect(recipients[0]?.identifierLabel).toBe('Phone Number');
    });

    it('keeps separate bill recipients that share a buyer phone', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            id: 'meter-1',
            type: 'electricity' as const,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766923',
            customer_name: 'FIRST METER',
            network_provider: null,
            phone_number: '08146978921',
            repeat_data_plan_code: null,
          },
          {
            ...baseTransaction,
            id: 'meter-2',
            type: 'electricity' as const,
            biller_name: 'EKEDC NG',
            biller_item_code: 'KUD-ELE-EKED-002',
            customer_identifier: '43901766924',
            customer_name: 'SECOND METER',
            network_provider: null,
            phone_number: '08146978921',
            repeat_data_plan_code: null,
          },
        ],
        'power'
      );

      expect(recipients).toHaveLength(2);
      expect(recipients.map((recipient) => recipient.identifier)).toEqual([
        '43901766923',
        '43901766924',
      ]);
    });

    it('maps cable tv transactions into smartcard recipients', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            type: 'cable_tv' as const,
            biller_name: 'DSTV',
            biller_item_code: 'DSTV-COMPACT',
            customer_identifier: '7034567890',
            customer_name: 'JANE DOE',
            network_provider: null,
            phone_number: null,
            repeat_data_plan_code: null,
          },
        ],
        'tv'
      );

      expect(recipients[0]).toEqual(
        expect.objectContaining({
          identifier: '7034567890',
          identifierLabel: 'Smartcard Number',
        })
      );
    });

    it('maps betting transactions into gaming recipients', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            type: 'betting' as const,
            biller_name: 'BET9JA',
            biller_item_code: 'BET9JA-TOPUP',
            customer_identifier: 'user_12345',
            customer_name: 'JOHN DOE',
            network_provider: null,
            phone_number: null,
            repeat_data_plan_code: null,
          },
        ],
        'gaming'
      );

      expect(recipients[0]).toEqual(
        expect.objectContaining({
          identifier: 'user_12345',
          identifierLabel: 'Account ID',
        })
      );
    });

    it('skips transactions whose type is not recognized by getRouteType', () => {
      const recipients = utilityRepeatHelpers.getRecentRecipients(
        [
          {
            ...baseTransaction,
            type: 'unknown_future_type' as unknown as 'airtime',
            biller_name: null,
            biller_item_code: null,
            customer_identifier: null,
            customer_name: null,
            network_provider: 'MTN',
            phone_number: '08012345678',
            repeat_data_plan_code: null,
          },
          {
            ...baseTransaction,
            type: 'airtime' as const,
            biller_name: null,
            biller_item_code: null,
            customer_identifier: null,
            customer_name: null,
            network_provider: 'MTN',
            phone_number: '08087654321',
            repeat_data_plan_code: null,
          },
        ],
        'airtime'
      );

      expect(recipients).toHaveLength(1);
      expect(recipients[0]?.identifier).toBe('08087654321');
    });
  });
});
