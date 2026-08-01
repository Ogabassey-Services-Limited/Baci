import { describe, expect, it } from 'vitest';
import { storeReadinessQuerySchema } from './store-readiness-query';

describe('storeReadinessQuerySchema', () => {
  it('defaults an omitted surface to web', () => {
    expect(storeReadinessQuerySchema.parse({})).toEqual({ surface: 'web' });
  });

  it('accepts an explicit mobile surface with a valid merchant ID', () => {
    expect(
      storeReadinessQuerySchema.parse({
        merchantId: '11111111-1111-4111-8111-111111111111',
        surface: 'mobile',
      })
    ).toEqual({
      merchantId: '11111111-1111-4111-8111-111111111111',
      surface: 'mobile',
    });
  });

  it('rejects an invalid merchant ID before it reaches UUID-backed lookup', () => {
    expect(
      storeReadinessQuerySchema.safeParse({ merchantId: 'not-a-uuid' }).success
    ).toBe(false);
  });

  it('rejects an unsupported readiness surface', () => {
    expect(
      storeReadinessQuerySchema.safeParse({ surface: 'desktop' }).success
    ).toBe(false);
  });
});
