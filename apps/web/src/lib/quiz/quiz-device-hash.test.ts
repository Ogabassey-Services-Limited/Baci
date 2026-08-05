import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetQuizDeviceHashPepper = vi.hoisted(() => vi.fn());
const mockIsProductionDeployment = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/quiz/quiz-runtime-env', () => ({
  getQuizDeviceHashPepper: mockGetQuizDeviceHashPepper,
  isProductionDeployment: mockIsProductionDeployment,
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

const SHA256_HEX = /^[0-9a-f]{64}$/;
const NATIVE_FINGERPRINT = 'a'.repeat(64);

function requestWithCookie(value?: string): NextRequest {
  return {
    cookies: {
      get: (name: string) =>
        value && name === 'baci_qdid' ? { name, value } : undefined,
    },
  } as unknown as NextRequest;
}

describe('resolveQuizDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuizDeviceHashPepper.mockReturnValue('quiz-device-pepper');
    mockIsProductionDeployment.mockReturnValue(false);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('peppers the mobile fingerprint instead of storing what the client sent', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const { deviceHash, cookieToSet } = resolveQuizDevice(
      requestWithCookie(),
      NATIVE_FINGERPRINT
    );

    expect(deviceHash).toMatch(SHA256_HEX);
    // The raw client value must never be the stored value: otherwise an attacker
    // could precompute or collide with another player's device identity.
    expect(deviceHash).not.toBe(NATIVE_FINGERPRINT);
    // Native devices need no cookie.
    expect(cookieToSet).toBeUndefined();
  });

  it('is stable for the same device and different across devices', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const first = resolveQuizDevice(requestWithCookie(), NATIVE_FINGERPRINT);
    const same = resolveQuizDevice(requestWithCookie(), NATIVE_FINGERPRINT);
    const other = resolveQuizDevice(requestWithCookie(), 'b'.repeat(64));

    expect(first.deviceHash).toBe(same.deviceHash);
    expect(first.deviceHash).not.toBe(other.deviceHash);
  });

  it('stays stable when the RPC proof secret rotates', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const beforeRotation = resolveQuizDevice(
      requestWithCookie(),
      NATIVE_FINGERPRINT
    );
    vi.stubEnv('QUIZ_RPC_SERVER_SECRET', 'rpc-secret-v2');
    const afterRotation = resolveQuizDevice(
      requestWithCookie(),
      NATIVE_FINGERPRINT
    );

    expect(afterRotation.deviceHash).toBe(beforeRotation.deviceHash);
  });

  it('mints an httpOnly cookie for a web client that has none', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const { deviceHash, cookieToSet } = resolveQuizDevice(requestWithCookie());

    expect(deviceHash).toMatch(SHA256_HEX);
    expect(cookieToSet).toMatchObject({
      name: 'baci_qdid',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    });
    // Server-chosen, so a page script cannot pick its own device identity.
    expect(cookieToSet?.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('marks the web device cookie secure in production', async () => {
    mockIsProductionDeployment.mockReturnValue(true);
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const { cookieToSet } = resolveQuizDevice(requestWithCookie());

    expect(cookieToSet?.secure).toBe(true);
  });

  it('reuses an existing web cookie so the device budget accumulates', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const first = resolveQuizDevice(requestWithCookie('existing-device-id'));
    const second = resolveQuizDevice(requestWithCookie('existing-device-id'));

    expect(first.deviceHash).toBe(second.deviceHash);
    // Nothing to mint — otherwise every request would reset the cap.
    expect(first.cookieToSet).toBeUndefined();
  });

  it('separates the native and web namespaces', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const native = resolveQuizDevice(requestWithCookie(), NATIVE_FINGERPRINT);
    const web = resolveQuizDevice(requestWithCookie(NATIVE_FINGERPRINT));

    // Same raw value, different source — must not collide into one identity.
    expect(native.deviceHash).not.toBe(web.deviceHash);
  });

  it('does not blow up when the request carries no cookie jar', async () => {
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    // An abuse control must never be the thing that 500s a legitimate start.
    const bare = {} as unknown as NextRequest;
    expect(() => resolveQuizDevice(bare)).not.toThrow();
    expect(resolveQuizDevice(bare).deviceHash).toMatch(SHA256_HEX);
  });

  it('fails soft when the device pepper is absent rather than storing an unpeppered value', async () => {
    mockGetQuizDeviceHashPepper.mockReturnValue(undefined);
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    const { deviceHash } = resolveQuizDevice(
      requestWithCookie(),
      NATIVE_FINGERPRINT
    );

    // Null means "do not device-cap this attempt" — the player still plays, and
    // the per-customer and email-identity caps still bound them.
    expect(deviceHash).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith({
      event: 'quiz_device_cap_degraded',
      message: 'Quiz device hash pepper is unavailable',
    });
  });

  it('fails soft when the device pepper getter rejects the runtime', async () => {
    mockGetQuizDeviceHashPepper.mockImplementation(() => {
      throw new Error('server-only secret');
    });
    const { resolveQuizDevice } = await import('./quiz-device-hash');

    expect(
      resolveQuizDevice(requestWithCookie(), NATIVE_FINGERPRINT).deviceHash
    ).toBeNull();
    expect(mockLogger.error).toHaveBeenCalledWith({
      error: expect.any(Error),
      event: 'quiz_device_cap_degraded',
      message: 'Quiz device hash pepper lookup failed',
    });
  });
});
