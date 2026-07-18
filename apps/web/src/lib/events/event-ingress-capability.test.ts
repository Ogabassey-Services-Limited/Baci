// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { Database } from '@/types/supabase';
import { createEventIngressClient } from './event-ingress-capability';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('server-only', () => ({}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  mocks.createClient.mockReset();
  vi.resetModules();
});

describe('createEventIngressClient', () => {
  it('constructs a generated Database client at the ingress boundary', () => {
    expectTypeOf(createEventIngressClient).returns.toEqualTypeOf<
      SupabaseClient<Database>
    >();
  });

  it('binds a short-lived anonymous capability to one analytics envelope', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
    const { createEventIngressClient } = await import(
      './event-ingress-capability'
    );

    mocks.createClient.mockReturnValue({ rpc: vi.fn() });
    await createEventIngressClient({
      eventId: 'evt_123',
      eventName: 'analytics.purchase.v1',
      eventTimestamp: '2026-07-14T00:00:00.000Z',
      eventType: 'purchase',
      kind: 'analytics',
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      producer: 'web',
      source: 'web',
      trustLevel: 'tenant_verified_client',
    });
    expect(mocks.createClient).toHaveBeenCalledOnce();

    const options = mocks.createClient.mock.calls[0]?.[2] as {
      accessToken: () => Promise<string>;
    };
    const token = await options.accessToken();
    const verified = await jwtVerify(
      token ?? '',
      new TextEncoder().encode('test-jwt-secret'),
      { audience: 'authenticated' }
    );
    expect(verified.payload).toMatchObject({
      baci_event_ingress_kind: 'analytics',
      baci_event_ingress_merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      baci_event_ingress_event_id: 'evt_123',
      baci_event_ingress_event_name: 'analytics.purchase.v1',
      baci_event_ingress_event_type: 'purchase',
      baci_event_ingress_source: 'web',
      baci_event_ingress_trust_level: 'tenant_verified_client',
      role: 'anon',
    });
  });

  it('uses the configured asymmetric Supabase signing key without a legacy secret', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'P-256',
    });
    const privateJwk = {
      ...privateKey.export({ format: 'jwk' }),
      alg: 'ES256',
      kid: 'event-ingress-test-key',
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_AGENTIC_JWT_PRIVATE_JWK = JSON.stringify(privateJwk);
    delete process.env.SUPABASE_JWT_SECRET;
    const { createEventIngressClient } = await import(
      './event-ingress-capability'
    );

    mocks.createClient.mockReturnValue({ rpc: vi.fn() });
    await createEventIngressClient({
      eventId: 'evt_private_key',
      eventName: 'analytics.purchase.v1',
      eventTimestamp: '2026-07-14T00:00:00.000Z',
      eventType: 'purchase',
      kind: 'analytics',
      merchantId: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
      producer: 'web',
      source: 'web',
      trustLevel: 'tenant_verified_client',
    });

    const options = mocks.createClient.mock.calls[0]?.[2] as {
      accessToken: () => Promise<string>;
    };
    const token = await options.accessToken();
    const verified = await jwtVerify(token, publicKey, {
      audience: 'authenticated',
    });
    expect(verified.protectedHeader).toMatchObject({
      alg: 'ES256',
      kid: 'event-ingress-test-key',
    });
    expect(verified.payload).toMatchObject({
      baci_event_ingress_event_id: 'evt_private_key',
      role: 'anon',
    });
  });
});
