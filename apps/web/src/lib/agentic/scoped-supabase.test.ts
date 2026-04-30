import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';

const mockCreateClient = vi.fn(
  (_url: string, _key: string, _options: unknown) => ({ from: vi.fn() })
);
const mockGetSupabaseJwtSecret = vi.fn(() => 'test-supabase-jwt-secret');

vi.mock('server-only', () => ({}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string, options: unknown) =>
    mockCreateClient(url, key, options),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseJwtSecret: () => mockGetSupabaseJwtSecret(),
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('Missing JWT payload');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    agentic_context: string;
    agentic_merchant_id: string;
    agentic_merchant_slug: string;
    aud: string;
    exp: number;
    role: string;
    sub: string;
  };
}

describe('createAgenticScopedSupabaseClient', () => {
  it('creates an anon-key client with merchant-scoped Authorization claims', () => {
    createAgenticScopedSupabaseClient({
      merchantId: '00000000-0000-4000-8000-000000000001',
      merchantSlug: 'ogabassey',
      now: new Date('2026-04-30T12:00:00.000Z'),
    });

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: {
          headers: {
            Authorization: expect.stringMatching(/^Bearer /),
          },
        },
      })
    );

    const options = mockCreateClient.mock.calls[0]?.[2] as {
      global: { headers: { Authorization: string } };
    };
    const authHeader = options.global.headers.Authorization;
    const claims = decodeJwtPayload(authHeader.replace('Bearer ', ''));

    expect(claims).toMatchObject({
      agentic_context: 'checkout',
      agentic_merchant_id: '00000000-0000-4000-8000-000000000001',
      agentic_merchant_slug: 'ogabassey',
      aud: 'authenticated',
      role: 'authenticated',
      sub: '00000000-0000-4000-8000-000000000001',
    });
    expect(claims.exp).toBe(1_777_550_700);
  });

  it('fails closed when SUPABASE_JWT_SECRET is missing', () => {
    mockGetSupabaseJwtSecret.mockImplementation(() => {
      throw new Error('SUPABASE_JWT_SECRET is not defined');
    });

    expect(() =>
      createAgenticScopedSupabaseClient({
        merchantId: '00000000-0000-4000-8000-000000000001',
        merchantSlug: 'ogabassey',
      })
    ).toThrow('SUPABASE_JWT_SECRET is not defined');
  });
});
