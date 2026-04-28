import { utilityRepeatHelpers } from './utility-repeat';

describe('utilityRepeatHelpers', () => {
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
});
