// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /.well-known/agent-auth', () => {
  it('serves manual registration metadata from the well-known URL', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/.well-known/agent-auth', {
        headers: { host: 'merchant.example.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'manual_approval_required',
      documentation: 'https://merchant.example.com/auth.md',
      claim_uri: 'https://merchant.example.com/.well-known/agent-auth/claim',
      revocation_uri:
        'https://merchant.example.com/.well-known/agent-auth/revoke',
    });
  });
});

describe('POST /.well-known/agent-auth', () => {
  it('delegates registration requests to the manual-review handler', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('https://ogabassey.com/.well-known/agent-auth', {
        body: JSON.stringify({
          assertion: 'eyJhbGciOiJFZERTQSJ9',
          assertion_type: 'urn:ietf:params:oauth:token-type:id-jag',
          requested_credential_type: 'api_key',
          type: 'identity_assertion',
        }),
        headers: { host: 'merchant.example.com' },
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'manual_approval_required',
      documentation: 'https://merchant.example.com/auth.md',
    });
    expect(body).not.toHaveProperty('credential');
  });
});
