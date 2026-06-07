// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /.well-known/oauth-authorization-server/agent-auth/v1', () => {
  it('publishes tenant-scoped Auth.md authorization server metadata', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request(
        'https://ogabassey.com/.well-known/oauth-authorization-server/agent-auth/v1',
        { headers: { host: 'merchant.example' } }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      issuer: 'https://merchant.example/agent-auth/v1',
      service_documentation: 'https://merchant.example/auth.md',
      agent_auth: {
        register_uri: 'https://merchant.example/.well-known/agent-auth',
        claim_uri: 'https://merchant.example/.well-known/agent-auth/claim',
        revocation_uri:
          'https://merchant.example/.well-known/agent-auth/revoke',
        identity_types_supported: ['identity_assertion'],
      },
    });
  });
});
