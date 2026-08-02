import { beforeEach, describe, expect, it, vi } from 'vitest';

import { strictCloudflareHostnamePurge } from './strict-cloudflare-hostname-purge';

describe('strictCloudflareHostnamePurge', () => {
  beforeEach(() => {
    vi.stubEnv('CLOUDFLARE_API_TOKEN', 'token');
    vi.stubEnv('CLOUDFLARE_ZONE_ID', 'zone');
  });

  it('confirms a bounded host purge only on provider success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );

    await expect(
      strictCloudflareHostnamePurge(['shop.example.com'], { fetchImpl })
    ).resolves.toEqual({ ok: true });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      hosts: ['shop.example.com'],
    });
  });

  it('returns a bounded Retry-After without provider response content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('sensitive provider body', {
        headers: { 'Retry-After': '120' },
        status: 429,
      })
    );

    await expect(
      strictCloudflareHostnamePurge(['shop.example.com'], { fetchImpl })
    ).resolves.toEqual({
      errorCode: 'cloudflare_http_429',
      ok: false,
      retryAfterSeconds: 120,
    });
  });

  it('preserves a zero-second Retry-After from Cloudflare', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { 'Retry-After': '0' },
        status: 429,
      })
    );

    await expect(
      strictCloudflareHostnamePurge(['shop.example.com'], { fetchImpl })
    ).resolves.toEqual({
      errorCode: 'cloudflare_http_429',
      ok: false,
      retryAfterSeconds: 0,
    });
  });

  it('fails closed without calling Cloudflare when more than 30 unique hosts are supplied', async () => {
    const fetchImpl = vi.fn();
    const hostnames = Array.from(
      { length: 31 },
      (_, index) => `shop-${index}.example.com`
    );

    await expect(
      strictCloudflareHostnamePurge(hostnames, { fetchImpl })
    ).resolves.toEqual({
      errorCode: 'cloudflare_hostname_limit_exceeded',
      ok: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed on timeout or network failure', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'));

    await expect(
      strictCloudflareHostnamePurge(['shop.example.com'], { fetchImpl })
    ).resolves.toEqual({
      errorCode: 'cloudflare_request_failed',
      ok: false,
    });
  });
});
