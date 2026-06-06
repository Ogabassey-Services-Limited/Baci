// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /.well-known/oauth-protected-resource', () => {
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

  it('publishes protected resource metadata for the current tenant host', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request(
        'https://ogabassey.com/.well-known/oauth-protected-resource',
        { headers: { host: 'merchant.example' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body).toEqual({
      resource: 'https://merchant.example/api',
      resource_name: 'Ogabassey Agentic Commerce API',
      resource_documentation: 'https://merchant.example/auth.md',
      authorization_servers: ['https://project.supabase.co/auth/v1'],
      scopes_supported: ['openid', 'email', 'profile', 'offline_access'],
      bearer_methods_supported: ['header'],
    });
  });

  it('uses the request URL host when Host header is absent', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request('https://ogabassey.com/.well-known/oauth-protected-resource')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body.resource).toBe('https://ogabassey.com/api');
    expect(body.resource_documentation).toBe('https://ogabassey.com/auth.md');
  });
});
