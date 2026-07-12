import { describe, expect, it, vi } from 'vitest';
import { resolveEventIngressContext } from './event-ingress-context';

function request(headers: Record<string, string>) {
  return { headers: new Headers(headers) };
}

function lookupClient(
  result: { id?: string; merchant_id?: string } | null,
  error: { message: string } | null = null
) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: result, error });
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle,
    select: vi.fn(() => builder),
  };
  return { from: vi.fn(() => builder) };
}

describe('resolveEventIngressContext', () => {
  it('derives and verifies a storefront slug from the request host', async () => {
    const result = await resolveEventIngressContext({
      merchantId: 'merchant-1',
      request: request({ host: 'shop.usebaci.com' }),
      supabase: lookupClient({ id: 'merchant-1' }) as never,
    });

    expect(result).toEqual({
      merchantId: 'merchant-1',
      ok: true,
      trustLevel: 'tenant_verified_client',
      verified: true,
    });
  });

  it('rejects a body merchant that differs from the host merchant', async () => {
    const result = await resolveEventIngressContext({
      merchantId: 'merchant-2',
      request: request({ host: 'shop.usebaci.com' }),
      supabase: lookupClient({ id: 'merchant-1' }) as never,
    });

    expect(result).toEqual({ code: 'merchant_mismatch', ok: false });
  });

  it('does not trust a spoofed merchant header on an unrelated host', async () => {
    const client = lookupClient({ id: 'merchant-1' });
    const result = await resolveEventIngressContext({
      merchantId: 'merchant-2',
      request: request({ host: 'usebaci.com', 'x-merchant-slug': 'shop' }),
      supabase: client as never,
    });

    expect(result).toEqual({
      merchantId: 'merchant-2',
      ok: true,
      trustLevel: 'anonymous_client',
      verified: false,
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('derives an apex custom domain from a www host', async () => {
    const result = await resolveEventIngressContext({
      merchantId: 'merchant-1',
      request: request({ host: 'www.shop.example' }),
      supabase: lookupClient({ merchant_id: 'merchant-1' }) as never,
    });

    expect(result).toMatchObject({
      merchantId: 'merchant-1',
      ok: true,
      trustLevel: 'tenant_verified_client',
    });
  });

  it('keeps an unknown tenant host anonymous', async () => {
    const result = await resolveEventIngressContext({
      merchantId: 'merchant-1',
      request: request({ host: 'unknown.usebaci.com' }),
      supabase: lookupClient(null) as never,
    });

    expect(result).toEqual({
      merchantId: 'merchant-1',
      ok: true,
      trustLevel: 'anonymous_client',
      verified: false,
    });
  });

  it('fails closed when the tenant lookup errors', async () => {
    const result = await resolveEventIngressContext({
      merchantId: 'merchant-1',
      request: request({ host: 'shop.usebaci.com' }),
      supabase: lookupClient(null, {
        message: 'database unavailable',
      }) as never,
    });

    expect(result).toEqual({ code: 'merchant_context_error', ok: false });
  });
});
