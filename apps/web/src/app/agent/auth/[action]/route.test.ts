// @vitest-environment node

import { describe, expect, it } from 'vitest';

const claimProps = { params: Promise.resolve({ action: 'claim' }) };
const revokeProps = { params: Promise.resolve({ action: 'revoke' }) };
const unsupportedProps = { params: Promise.resolve({ action: 'complete' }) };

describe('GET /agent/auth/[action]', () => {
  it('describes supported claim and revoke actions', async () => {
    const { GET } = await import('./route');

    const claimResponse = await GET(
      new Request('https://ogabassey.com/agent/auth/claim', {
        headers: { host: 'merchant.example.com' },
      }),
      claimProps
    );
    const revokeResponse = await GET(
      new Request('https://ogabassey.com/agent/auth/revoke'),
      revokeProps
    );

    await expect(claimResponse.json()).resolves.toMatchObject({
      action: 'claim',
      documentation: 'https://merchant.example.com/auth.md',
      status: 'manual_claim_required',
    });
    await expect(revokeResponse.json()).resolves.toMatchObject({
      action: 'revoke',
      status: 'revocation_received',
    });
  });

  it('returns 404 for unsupported actions', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/agent/auth/complete'),
      unsupportedProps
    );

    expect(response.status).toBe(404);
  });
});

describe('POST /agent/auth/[action]', () => {
  it('accepts valid claim and revoke action payloads for manual review', async () => {
    const { POST } = await import('./route');

    const claimResponse = await POST(
      new Request('https://ogabassey.com/agent/auth/claim', {
        body: JSON.stringify({ email: 'agent@example.com', otp: '123456' }),
        method: 'POST',
      }),
      claimProps
    );
    const revokeResponse = await POST(
      new Request('https://ogabassey.com/agent/auth/revoke', {
        body: JSON.stringify({ logout_token: 'logout.jwt' }),
        method: 'POST',
      }),
      revokeProps
    );

    expect(claimResponse.status).toBe(200);
    await expect(claimResponse.json()).resolves.toMatchObject({
      status: 'manual_claim_required',
    });
    expect(revokeResponse.status).toBe(200);
    await expect(revokeResponse.json()).resolves.toMatchObject({
      status: 'revocation_received',
    });
  });

  it('rejects invalid action payloads', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('https://ogabassey.com/agent/auth/claim', {
        body: JSON.stringify({ otp: '123456' }),
        method: 'POST',
      }),
      claimProps
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid input',
      code: 'INVALID_INPUT',
    });
  });

  it('returns 404 for unsupported actions', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new Request('https://ogabassey.com/agent/auth/complete', {
        body: JSON.stringify({ registration_id: 'reg_123' }),
        method: 'POST',
      }),
      unsupportedProps
    );

    expect(response.status).toBe(404);
  });
});
