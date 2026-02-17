import { describe, expect, it } from 'vitest';
import { DEMO_MERCHANTS, getDemoMerchant } from './mock-data';

describe('getDemoMerchant', () => {
  it('returns null for unknown slug', () => {
    expect(getDemoMerchant('unknown-store')).toBeNull();
    expect(getDemoMerchant('')).toBeNull();
  });

  it.each([
    'gadget-default-template',
    'ogabassey',
    'premium-default',
    'new-template-demo',
    'gadget-universe-demo',
  ])('returns merchant data for demo slug: %s', (slug) => {
    const merchant = getDemoMerchant(slug);
    expect(merchant).not.toBeNull();
    expect(merchant?.id).toBeTruthy();
    expect(merchant?.user_id).toBe('demo-user');
    expect(merchant?.business_name).toBeTruthy();
    expect(merchant?.business_type).toBeTruthy();
    expect(merchant?.slug).toBe(slug);
  });

  it('DEMO_MERCHANTS has exactly 5 entries', () => {
    expect(Object.keys(DEMO_MERCHANTS)).toHaveLength(5);
  });
});
