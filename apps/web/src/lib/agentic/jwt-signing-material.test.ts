import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAgenticJwtPrivateJwk: vi.fn(),
  getSupabaseJwtSecret: vi.fn(() => 'legacy-test-secret'),
  loggerWarn: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/env', () => ({
  getSupabaseAgenticJwtPrivateJwk: () =>
    mocks.getSupabaseAgenticJwtPrivateJwk(),
  getSupabaseJwtSecret: () => mocks.getSupabaseJwtSecret(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: mocks.loggerWarn,
  },
}));

describe('agentic JWT signing material', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSupabaseAgenticJwtPrivateJwk.mockReturnValue(undefined);
  });

  it('resolves importable Supabase signing keys as usable', async () => {
    mocks.getSupabaseAgenticJwtPrivateJwk.mockReturnValue(
      JSON.stringify(createPrivateJwk())
    );
    const { getAgenticJwtSigningMaterial, hasUsableAgenticJwtSigningMaterial } =
      await import('@/lib/agentic/jwt-signing-material');

    const material = getAgenticJwtSigningMaterial();

    expect(material.type).toBe('private-jwk');
    expect(hasUsableAgenticJwtSigningMaterial()).toBe(true);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
    expect(mocks.getSupabaseJwtSecret).not.toHaveBeenCalled();
  });

  it('resolves importable Supabase signing keys without alg as usable', async () => {
    const { alg: _alg, ...privateJwkWithoutAlg } = createPrivateJwk();
    mocks.getSupabaseAgenticJwtPrivateJwk.mockReturnValue(
      JSON.stringify(privateJwkWithoutAlg)
    );
    const { getAgenticJwtSigningMaterial, hasUsableAgenticJwtSigningMaterial } =
      await import('@/lib/agentic/jwt-signing-material');

    const material = getAgenticJwtSigningMaterial();

    expect(material.type).toBe('private-jwk');
    expect(hasUsableAgenticJwtSigningMaterial()).toBe(true);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
    expect(mocks.getSupabaseJwtSecret).not.toHaveBeenCalled();
  });

  it('falls back to the legacy JWT secret when a configured JWK cannot be imported', async () => {
    mocks.getSupabaseAgenticJwtPrivateJwk.mockReturnValue(
      JSON.stringify({
        alg: 'ES256',
        crv: 'P-256',
        d: 'not-importable',
        kid: 'agentic-test-key',
        kty: 'EC',
        x: 'not-importable',
        y: 'not-importable',
      })
    );
    const { getAgenticJwtSigningMaterial, hasUsableAgenticJwtSigningMaterial } =
      await import('@/lib/agentic/jwt-signing-material');

    expect(getAgenticJwtSigningMaterial()).toEqual({
      secret: 'legacy-test-secret',
      type: 'legacy-secret',
    });
    expect(hasUsableAgenticJwtSigningMaterial()).toBe(true);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('Invalid JWK'),
        message:
          'Agentic JWT private JWK is invalid; falling back to legacy JWT secret',
      })
    );
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(1);
    expect(mocks.getSupabaseJwtSecret).toHaveBeenCalled();
  });

  it('falls back to the legacy JWT secret only when no JWK is configured', async () => {
    const { getAgenticJwtSigningMaterial, hasUsableAgenticJwtSigningMaterial } =
      await import('@/lib/agentic/jwt-signing-material');

    const material = getAgenticJwtSigningMaterial();

    expect(material).toEqual({
      secret: 'legacy-test-secret',
      type: 'legacy-secret',
    });
    expect(hasUsableAgenticJwtSigningMaterial()).toBe(true);
  });
});

function createPrivateJwk() {
  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  return {
    ...privateKey.export({ format: 'jwk' }),
    alg: 'ES256',
    kid: 'agentic-test-key',
  };
}
