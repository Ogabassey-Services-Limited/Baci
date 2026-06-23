import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetStorefrontAuthAbuseForTesting,
  checkStorefrontOtpSendLimit,
  checkStorefrontOtpVerifyLockout,
  recordStorefrontOtpVerifyFailure,
  resetStorefrontOtpVerifyFailures,
} from './storefront-auth-abuse';

const { mockGetRedis } = vi.hoisted(() => ({
  mockGetRedis: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

describe('storefront auth abuse controls', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGetRedis.mockReturnValue(null);
    __resetStorefrontAuthAbuseForTesting();
  });

  it('limits OTP sends per merchant and email identifier', async () => {
    const input = { email: 'Customer@Example.com', merchantId: 'merchant-1' };

    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({ allowed: true, remaining: 3 })
    );
    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({ allowed: true, remaining: 2 })
    );
    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({ allowed: true, remaining: 1 })
    );
    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({ allowed: true, remaining: 0 })
    );
    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({ allowed: false, remaining: 0 })
    );
  });

  it('requires captcha above the send threshold only when captcha enforcement is enabled', async () => {
    vi.stubEnv('STOREFRONT_AUTH_CAPTCHA_ENABLED', 'true');
    const input = { email: 'customer@example.com', merchantId: 'merchant-1' };

    await checkStorefrontOtpSendLimit(input);
    await checkStorefrontOtpSendLimit(input);

    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({
        allowed: true,
        captchaRequired: true,
      })
    );
    expect(
      await checkStorefrontOtpSendLimit({ ...input, captchaToken: 'token' })
    ).toEqual(
      expect.objectContaining({
        allowed: true,
        captchaRequired: false,
      })
    );
  });

  it('locks verification after repeated failed OTP checks and resets after success', async () => {
    const input = { email: 'customer@example.com', merchantId: 'merchant-1' };

    for (let attempt = 0; attempt < 9; attempt += 1) {
      expect(await recordStorefrontOtpVerifyFailure(input)).toEqual(
        expect.objectContaining({ locked: false })
      );
    }

    expect(await checkStorefrontOtpVerifyLockout(input)).toEqual(
      expect.objectContaining({ locked: false, remaining: 1 })
    );
    expect(await recordStorefrontOtpVerifyFailure(input)).toEqual(
      expect.objectContaining({ locked: true, remaining: 0 })
    );
    expect(await checkStorefrontOtpVerifyLockout(input)).toEqual(
      expect.objectContaining({ locked: true, remaining: 0 })
    );

    await resetStorefrontOtpVerifyFailures(input);

    expect(await checkStorefrontOtpVerifyLockout(input)).toEqual(
      expect.objectContaining({ locked: false, remaining: 10 })
    );
  });

  it('parses Redis string counters for OTP send and verification lockout checks', async () => {
    const counts = new Map<string, number>();
    mockGetRedis.mockReturnValue({
      createScript: () => ({
        eval: ([key]: string[]) => {
          const count = (counts.get(key) ?? 0) + 1;
          counts.set(key, count);
          return String(count);
        },
      }),
      del: vi.fn(),
      get: vi.fn(async () => '10'),
    });

    const input = { email: 'customer@example.com', merchantId: 'merchant-1' };

    expect(await checkStorefrontOtpSendLimit(input)).toEqual(
      expect.objectContaining({ allowed: true, remaining: 3 })
    );
    expect(await checkStorefrontOtpVerifyLockout(input)).toEqual(
      expect.objectContaining({ locked: true, remaining: 0 })
    );
  });
});
