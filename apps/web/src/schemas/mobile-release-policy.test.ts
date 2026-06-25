import { describe, expect, it } from 'vitest';
import {
  appStoreWebhookQuerySchema,
  mobileReleasePolicyQuerySchema,
} from './mobile-release-policy';

const validQuery = {
  app: 'storefront',
  buildNumber: '42',
  channel: 'production',
  nativeVersion: '2.0.0',
  platform: 'ios',
  runtimeVersion: '2.0.0',
} as const;

describe('mobileReleasePolicyQuerySchema', () => {
  it('accepts a valid storefront update policy query', () => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse(validQuery);

    expect(parsed.success).toBe(true);
  });

  it('trims update string fields', () => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse({
      ...validQuery,
      buildNumber: '  42  ',
      channel: '  production  ',
      nativeVersion: '  2.0.0  ',
      runtimeVersion: '  2.0.0  ',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        buildNumber: '42',
        channel: 'production',
        nativeVersion: '2.0.0',
        runtimeVersion: '2.0.0',
      });
    }
  });

  it.each([
    'ios',
    'android',
  ] as const)('accepts %s as a platform', (platform) => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse({
      ...validQuery,
      platform,
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    'storefront',
    'admin',
  ] as const)('accepts %s as a mobile app', (app) => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse({
      ...validQuery,
      app,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects unsupported apps', () => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse({
      ...validQuery,
      app: 'desktop',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects unsupported platforms', () => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse({
      ...validQuery,
      platform: 'web',
    });

    expect(parsed.success).toBe(false);
  });

  it.each([
    'buildNumber',
    'channel',
    'nativeVersion',
    'runtimeVersion',
  ] as const)('rejects whitespace-only %s values', (field) => {
    const parsed = mobileReleasePolicyQuerySchema.safeParse({
      ...validQuery,
      [field]: '   ',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('appStoreWebhookQuerySchema', () => {
  it('defaults to the storefront app when app is omitted', () => {
    const parsed = appStoreWebhookQuerySchema.safeParse({});

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.app).toBe('storefront');
    }
  });

  it('accepts the admin webhook app', () => {
    const parsed = appStoreWebhookQuerySchema.safeParse({ app: 'admin' });

    expect(parsed.success).toBe(true);
  });

  it('rejects unknown webhook apps', () => {
    const parsed = appStoreWebhookQuerySchema.safeParse({ app: 'desktop' });

    expect(parsed.success).toBe(false);
  });
});
