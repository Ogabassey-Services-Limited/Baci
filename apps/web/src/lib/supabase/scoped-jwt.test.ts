import { Buffer } from 'node:buffer';
import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgenticJwtSigningMaterial } from '@/lib/agentic/jwt-signing-material';
import { signScopedSupabaseJwt } from './scoped-jwt';

const mocks = vi.hoisted(() => ({
  getSupabaseAgenticJwtPrivateJwk: vi.fn(),
  getSupabaseJwtSecret: vi.fn(() => 'default-secret'),
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

describe('signScopedSupabaseJwt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseAgenticJwtPrivateJwk.mockReturnValue(undefined);
    mocks.getSupabaseJwtSecret.mockReturnValue('default-secret');
  });

  it('uses configured signing material when no explicit signer is passed', () => {
    const token = signScopedSupabaseJwt({
      merchant_id: '11111111-1111-4111-8111-111111111111',
      role: 'anon',
    });

    const { encodedBody, encodedHeader, encodedSignature, header, payload } =
      decodeJwt(token);

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload).toMatchObject({
      merchant_id: '11111111-1111-4111-8111-111111111111',
      role: 'anon',
    });
    expect(mocks.getSupabaseJwtSecret).toHaveBeenCalledTimes(1);
    const expectedSignature = createHmac('sha256', 'default-secret')
      .update(`${encodedHeader}.${encodedBody}`)
      .digest('base64url');
    expect(encodedSignature).toBe(expectedSignature);
  });

  it('signs scoped Supabase claims with the legacy JWT secret', () => {
    const token = signScopedSupabaseJwt(
      {
        exp: 1_700_000_300,
        iat: 1_700_000_000,
        merchant_id: '11111111-1111-4111-8111-111111111111',
        role: 'anon',
      },
      { secret: 'legacy-secret', type: 'legacy-secret' }
    );

    const { encodedBody, encodedHeader, encodedSignature, header, payload } =
      decodeJwt(token);

    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload).toMatchObject({
      exp: 1_700_000_300,
      iat: 1_700_000_000,
      merchant_id: '11111111-1111-4111-8111-111111111111',
      role: 'anon',
    });
    const expectedSignature = createHmac('sha256', 'legacy-secret')
      .update(`${encodedHeader}.${encodedBody}`)
      .digest('base64url');
    expect(encodedSignature).toBe(expectedSignature);
  });

  it('signs scoped Supabase claims with an imported private JWK', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const jwk = {
      ...privateKey.export({ format: 'jwk' }),
      alg: 'ES256',
      kid: 'agentic-test-key',
    } as Extract<AgenticJwtSigningMaterial, { type: 'private-jwk' }>['jwk'];

    const token = signScopedSupabaseJwt(
      {
        exp: 1_700_000_300,
        iat: 1_700_000_000,
        merchant_id: '11111111-1111-4111-8111-111111111111',
        role: 'anon',
      },
      {
        jwk,
        keyObject: privateKey,
        type: 'private-jwk',
      }
    );

    const { encodedBody, encodedHeader, encodedSignature, header, payload } =
      decodeJwt(token);

    expect(header).toEqual({
      alg: 'ES256',
      kid: 'agentic-test-key',
      typ: 'JWT',
    });
    expect(payload.merchant_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(
      verify(
        'sha256',
        Buffer.from(`${encodedHeader}.${encodedBody}`),
        {
          dsaEncoding: 'ieee-p1363',
          key: publicKey,
        },
        Buffer.from(encodedSignature, 'base64url')
      )
    ).toBe(true);
  });

  it('throws when signing material is malformed', () => {
    expect(() =>
      signScopedSupabaseJwt(
        {
          merchant_id: '11111111-1111-4111-8111-111111111111',
          role: 'anon',
        },
        { type: 'unsupported' } as never
      )
    ).toThrow();
  });
});

function decodeJwt(token: string) {
  const [encodedHeader, encodedBody, encodedSignature] = token.split('.');
  return {
    encodedBody,
    encodedHeader,
    encodedSignature,
    header: JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8')
    ),
    payload: JSON.parse(Buffer.from(encodedBody, 'base64url').toString('utf8')),
  };
}
