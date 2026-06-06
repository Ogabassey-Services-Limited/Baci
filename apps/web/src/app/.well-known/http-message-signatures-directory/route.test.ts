// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestKeys } from '@/lib/agentic/web-bot-auth-test-keys';

describe('GET /.well-known/http-message-signatures-directory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 503 when Web Bot Auth signing material is not configured', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request(
        'https://ogabassey.com/.well-known/http-message-signatures-directory',
        { headers: { host: 'ogabassey.com' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Service unavailable: signing key not configured');
  });

  it('publishes a signed Web Bot Auth JWKS when keys are configured', async () => {
    const keys = buildTestKeys();
    vi.stubEnv('WEB_BOT_AUTH_PUBLIC_JWKS_JSON', keys.publicJwksJson);
    vi.stubEnv('WEB_BOT_AUTH_PRIVATE_KEY_PEM', keys.privateKeyPem);

    const { GET } = await import('./route');
    const response = GET(
      new Request(
        'https://ogabassey.com/.well-known/http-message-signatures-directory',
        { headers: { host: 'ogabassey.com' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/http-message-signatures-directory+json'
    );
    expect(response.headers.get('signature')).toMatch(/^sig1=:.+:$/);
    expect(body.keys).toEqual([
      expect.objectContaining({ crv: 'Ed25519', kty: 'OKP' }),
    ]);
  });

  it('returns 503 when Web Bot Auth signing material is malformed', async () => {
    const keys = buildTestKeys();
    vi.stubEnv('WEB_BOT_AUTH_PUBLIC_JWKS_JSON', keys.publicJwksJson);
    vi.stubEnv('WEB_BOT_AUTH_PRIVATE_KEY_PEM', 'not a private key');

    const { GET } = await import('./route');
    const response = GET(
      new Request(
        'https://ogabassey.com/.well-known/http-message-signatures-directory',
        { headers: { host: 'ogabassey.com' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe('Service unavailable: signing key not configured');
  });
});
