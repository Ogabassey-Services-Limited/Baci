import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { createEventPipelineTestClient } from '@/lib/events/event-pipeline-test-client';

import { resolveLegacyFanoutContext } from './resolve-legacy-fanout-context';

function lookupClient(result: { id?: string; merchant_id?: string } | null) {
  const testFetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json(result)
  );
  return Object.assign(createEventPipelineTestClient(testFetch), { testFetch });
}

describe('resolveLegacyFanoutContext', () => {
  it('returns identity resolved from a tenant-specific request host', async () => {
    await expect(
      resolveLegacyFanoutContext({
        merchantId: 'merchant-1',
        request: new NextRequest('https://shop.usebaci.com/api/events', {
          headers: { host: 'shop.usebaci.com' },
        }),
        supabase: lookupClient({ id: 'merchant-1' }),
      })
    ).resolves.toBe('merchant-1');
  });

  it('returns null when the host resolves to another merchant', async () => {
    await expect(
      resolveLegacyFanoutContext({
        merchantId: 'body-merchant',
        request: new NextRequest('https://shop.usebaci.com/api/events', {
          headers: { host: 'shop.usebaci.com' },
        }),
        supabase: lookupClient({ id: 'host-merchant' }),
      })
    ).resolves.toBeNull();
  });

  it('does not grant authority from a root-host spoofed referer', async () => {
    const client = lookupClient({ id: 'merchant-1' });
    await expect(
      resolveLegacyFanoutContext({
        merchantId: 'merchant-1',
        request: new NextRequest('https://usebaci.com/api/events', {
          headers: {
            host: 'usebaci.com',
            referer: 'https://usebaci.com/shop/products/phone',
          },
        }),
        supabase: client,
      })
    ).resolves.toBeNull();
    expect(client.testFetch).not.toHaveBeenCalled();
  });
});
