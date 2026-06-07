// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('GET /agent/auth', () => {
  it('describes manual agent registration for the current host', async () => {
    const { GET } = await import('./route');
    const response = GET(
      new Request('https://ogabassey.com/agent/auth', {
        headers: { host: 'merchant.example.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      status: 'manual_approval_required',
      credential_type: 'api_key',
      credential_format: 'bearer_hmac',
      documentation: 'https://merchant.example.com/auth.md',
      claim_uri: 'https://merchant.example.com/agent/auth/claim',
      revocation_uri: 'https://merchant.example.com/agent/auth/revoke',
    });
    expect(body).not.toHaveProperty('credential');
  });
});

describe('POST /agent/auth', () => {
  it('accepts valid identity assertion registration requests for review', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('https://ogabassey.com/agent/auth', {
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
    expect(body.status).toBe('manual_approval_required');
    expect(body).not.toHaveProperty('credential');
  });

  it('rejects unsupported registration requests', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('https://ogabassey.com/agent/auth', {
        body: JSON.stringify({ type: 'anonymous' }),
        method: 'POST',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid input', code: 'INVALID_INPUT' });
  });
});
