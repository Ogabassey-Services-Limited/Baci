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
        repeatVerified: '1',
      })
    ).toEqual({
      repeatAmount: 2500,
      repeatBillerName: 'EKEDC NG',
      repeatBillItemIdentifier: 'PREPAID',
      repeatCustomerIdentifier: '1234567890',
      repeatDataPlanCode: 'DATA-1GB',
      repeatNetworkProvider: 'mtn',
      repeatPhoneNumber: '08012345678',
      repeatVerified: true,
    });
  });

  it.each([
    ['zero amount', { repeatAmount: '0' }, 'repeatAmount'],
    ['NaN amount', { repeatAmount: 'NaN' }, 'repeatAmount'],
    ['US phone number', { repeatPhoneNumber: '+15551234567' }, 'repeatPhoneNumber'],
  ])('rejects semantic invalid repeat params for %s', (_label, params, path) => {
    const result = RouteRepeatParamsSchema.safeParse(params);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual([path]);
    }
  });

  it('coerces numeric amounts and boolean repeat flags', () => {
    expect(
      RouteRepeatParamsSchema.parse({
        repeatAmount: 2500,
        repeatVerified: 'false',
      })
    ).toEqual({
      repeatAmount: 2500,
      repeatVerified: false,
    });
  });

  it('returns undefined for empty optional repeat strings', () => {
    const result = RouteRepeatParamsSchema.parse({
      repeatBillerName: ' ',
      repeatBillItemIdentifier: '',
      repeatCustomerIdentifier: '\t',
      repeatDataPlanCode: '   ',
      repeatNetworkProvider: '',
    });

    expect(result.repeatBillerName).toBeUndefined();
    expect(result.repeatBillItemIdentifier).toBeUndefined();
    expect(result.repeatCustomerIdentifier).toBeUndefined();
    expect(result.repeatDataPlanCode).toBeUndefined();
    expect(result.repeatNetworkProvider).toBeUndefined();
  });

  it('rejects an empty repeat phone number before Nigerian phone parsing', () => {
    const result = RouteRepeatParamsSchema.safeParse({
      repeatPhoneNumber: ' ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['repeatPhoneNumber']);
      expect(result.error.issues[0]?.message).toBe(
        'Repeat phone number cannot be empty'
      );
    }
  });

  it('rejects unsupported repeat flags', () => {
    const result = RouteRepeatParamsSchema.safeParse({
      repeatVerified: 'yes',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['repeatVerified']);
    }
  });
});
