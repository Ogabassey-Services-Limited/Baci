// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /.well-known/oauth-authorization-server', () => {
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

  it('publishes OAuth discovery metadata for the configured auth server', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request(
        'https://ogabassey.com/.well-known/oauth-authorization-server',
        { headers: { host: 'merchant.example' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      issuer: 'https://project.supabase.co/auth/v1',
      authorization_endpoint:
        'https://project.supabase.co/auth/v1/oauth/authorize',
      token_endpoint: 'https://project.supabase.co/auth/v1/oauth/token',
      jwks_uri: 'https://project.supabase.co/auth/v1/.well-known/jwks.json',
      userinfo_endpoint: 'https://project.supabase.co/auth/v1/oauth/userinfo',
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: 'https://merchant.example/auth.md',
    });
  });
});
