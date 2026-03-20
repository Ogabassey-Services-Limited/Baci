import { describe, expect, it } from 'vitest';
import { PlatformSettingsUpdateSchema } from './schema';

describe('PlatformSettingsUpdateSchema', () => {
  it('parses valid update payloads and coerces numeric values', () => {
    const result = PlatformSettingsUpdateSchema.safeParse({
      platform_fee_percentage: '2.5',
      platform_fee_flat: '100',
      support_email: 'support@baci.app',
      enable_custom_domains: true,
      created_at: 'should be stripped',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected schema parse to succeed');
    }

    expect(result.data).toEqual({
      platform_fee_percentage: 2.5,
      platform_fee_flat: 100,
      support_email: 'support@baci.app',
      enable_custom_domains: true,
    });
    expect('created_at' in result.data).toBe(false);
  });

  it('rejects invalid email addresses and negative fee values', () => {
    const result = PlatformSettingsUpdateSchema.safeParse({
      support_email: 'not-an-email',
      platform_fee_flat: -1,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected schema parse to fail');
    }

    expect(result.error.flatten().fieldErrors.support_email).toBeDefined();
    expect(result.error.flatten().fieldErrors.platform_fee_flat).toBeDefined();
  });
});
