import { describe, expect, it, vi } from 'vitest';
import { fetchMetaJson } from './provider-http';

describe('Meta Ads provider HTTP boundary', () => {
  it('retries a throttled response without exposing the provider body', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 613, secret: 'nope' } }), {
          status: 400,
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      fetchMetaJson(
        new URL('https://graph.facebook.com/v25.0/me'),
        'access',
        'META_ADS_FAILED',
        fetchImpl,
        sleep
      )
    ).resolves.toEqual({ data: [] });
    expect(sleep).toHaveBeenCalledOnce();
  });
});
