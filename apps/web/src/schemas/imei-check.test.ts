import { describe, expect, it } from 'vitest';
import { imeiCheckSchema } from './imei-check';

describe('imeiCheckSchema', () => {
  it('accepts async capability and supported device context', () => {
    expect(
      imeiCheckSchema.parse({
        clientCapabilities: ['imei-async-v1'],
        device: 'smartphone',
        imei: '490154203237518',
        merchantSlug: 'ogabassey',
        tier: 'blacklist',
      })
    ).toMatchObject({
      clientCapabilities: ['imei-async-v1'],
      device: 'smartphone',
      merchantSlug: 'ogabassey',
    });
  });

  it('rejects an invalid path-storefront merchant identifier', () => {
    expect(
      imeiCheckSchema.safeParse({
        imei: '490154203237518',
        merchantSlug: '../another-store',
        tier: 'blacklist',
      }).success
    ).toBe(false);
  });

  it('rejects device context that the tier does not support', () => {
    expect(
      imeiCheckSchema.safeParse({
        device: 'watch',
        imei: '490154203237518',
        tier: 'blacklist',
      }).success
    ).toBe(false);
  });

  it('defaults missing client capabilities for legacy clients', () => {
    expect(
      imeiCheckSchema.parse({ imei: '490154203237518', tier: 'blacklist' })
        .clientCapabilities
    ).toEqual([]);
  });

  it('returns validation errors instead of throwing for an unknown tier with a device', () => {
    expect(() =>
      imeiCheckSchema.safeParse({
        device: 'laptop',
        imei: 'ABCDEFGH12',
        tier: 'not-a-real-tier',
      })
    ).not.toThrow();
    expect(
      imeiCheckSchema.safeParse({
        device: 'laptop',
        imei: 'ABCDEFGH12',
        tier: 'not-a-real-tier',
      }).success
    ).toBe(false);
  });
});
