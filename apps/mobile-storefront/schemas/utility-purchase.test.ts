import { describe, expect, it } from '@jest/globals';
import { RouteRepeatParamsSchema } from '@/schemas/utility-purchase';

describe('RouteRepeatParamsSchema', () => {
  it('parses empty route repeat params', () => {
    expect(RouteRepeatParamsSchema.parse({})).toEqual({});
  });

  it('parses supported string repeat params', () => {
    expect(
      RouteRepeatParamsSchema.parse({
        repeatAmount: '2500',
        repeatBillerName: 'EKEDC NG',
        repeatBillItemIdentifier: 'PREPAID',
        repeatCustomerIdentifier: '1234567890',
        repeatDataPlanCode: 'DATA-1GB',
        repeatNetworkProvider: 'mtn',
        repeatPhoneNumber: '08012345678',
        repeatVerified: 'true',
      })
    ).toEqual({
      repeatAmount: '2500',
      repeatBillerName: 'EKEDC NG',
      repeatBillItemIdentifier: 'PREPAID',
      repeatCustomerIdentifier: '1234567890',
      repeatDataPlanCode: 'DATA-1GB',
      repeatNetworkProvider: 'mtn',
      repeatPhoneNumber: '08012345678',
      repeatVerified: 'true',
    });
  });

  it('rejects non-string route repeat params', () => {
    const result = RouteRepeatParamsSchema.safeParse({
      repeatAmount: 2500,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['repeatAmount']);
    }
  });
});
