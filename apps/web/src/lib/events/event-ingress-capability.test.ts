// @vitest-environment node
import { jwtVerify } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  mocks.createClient.mockReset();
  vi.resetModules();
});

describe('createEventIngressClient', () => {
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
});
