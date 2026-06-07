// @vitest-environment node

import { describe, expect, it } from 'vitest';

const claimProps = { params: Promise.resolve({ action: 'claim' }) };
const revokeProps = { params: Promise.resolve({ action: 'revoke' }) };

describe('GET /.well-known/agent-auth/[action]', () => {
  it('serves claim and revoke action metadata from well-known URLs', async () => {
    const { GET } = await import('./route');

    const claimResponse = await GET(
      new Request('https://ogabassey.com/.well-known/agent-auth/claim', {
        headers: { host: 'merchant.example.com' },
      }),
      claimProps
    );
    const revokeResponse = await GET(
      new Request('https://ogabassey.com/.well-known/agent-auth/revoke'),
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
});
