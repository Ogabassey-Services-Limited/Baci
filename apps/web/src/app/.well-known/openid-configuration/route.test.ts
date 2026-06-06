// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /.well-known/openid-configuration', () => {
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

  it('serves the same OIDC discovery shape as OAuth discovery', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request('https://ogabassey.com/.well-known/openid-configuration', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.issuer).toBe('https://project.supabase.co/auth/v1');
    expect(body.scopes_supported).toContain('openid');
    expect(body.code_challenge_methods_supported).toEqual(['S256']);
    expect(body.userinfo_endpoint).toBe(
      'https://project.supabase.co/auth/v1/oauth/userinfo'
    );
  });
});
