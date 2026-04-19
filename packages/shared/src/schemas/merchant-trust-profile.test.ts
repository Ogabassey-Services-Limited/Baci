import { describe, expect, it } from 'vitest';
import { MerchantTrustProfileDraftSchema } from './merchant-trust-profile';

describe('merchant trust profile schema', () => {
  it('accepts the documented Ogabassey trust profile payload', () => {
    const result = MerchantTrustProfileDraftSchema.safeParse({
      founded_year: 2018,
      customer_service: {
        whatsapp_number: '+2348111111111',
        hours_summary: 'Mon-Sat, 8am-6pm',
        timezone: 'Africa/Lagos',
        response_time_summary: 'Within 2 business hours',
      },
      return_policy: {
        summary: 'Returns accepted for defective items.',
        window_days: 7,
        return_method: 'mail',
        return_fees: 'free',
      },
      shipping_policy: {
        summary: 'Nationwide delivery available.',
        regions: ['NG'],
        handling_days_min: 0,
        handling_days_max: 1,
        transit_days_min: 1,
        transit_days_max: 5,
        shipping_fee_type: 'calculated',
      },
      warranty_policy: {
        summary: 'Manufacturer warranty applies.',
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts an empty object without inventing defaults', () => {
    const result = MerchantTrustProfileDraftSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('rejects a non-object top-level payload', () => {
    const result = MerchantTrustProfileDraftSchema.safeParse([]);

    expect(result.success).toBe(false);
  });

  it('rejects malformed nested field types', () => {
    const result = MerchantTrustProfileDraftSchema.safeParse({
      shipping_policy: {
        regions: ['NG', 123],
      },
      return_policy: {
        window_days: '7',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining([
        'shipping_policy.regions.1',
        'return_policy.window_days',
      ])
    );
  });

  it('rejects unsupported keys at the top level and in nested objects', () => {
    const result = MerchantTrustProfileDraftSchema.safeParse({
      support_email: 'support@ogabassey.com',
      customer_service: {
        timezone: 'Africa/Lagos',
        unsupported_field: 'nope',
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['', 'customer_service'])
    );
  });
});
