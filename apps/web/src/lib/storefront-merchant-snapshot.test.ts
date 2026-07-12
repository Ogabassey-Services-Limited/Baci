import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { StorefrontDatabase } from '@/types/storefront-database';
import { readStorefrontMerchantSnapshot } from './storefront-merchant-snapshot';

function createClient(response: unknown) {
  // Mirror the postgrest-js builder chain used by the reader:
  // rpc(...).abortSignal(signal).retry(false) → awaitable response.
  const retry = vi.fn().mockResolvedValue(response);
  const abortSignal = vi.fn(() => ({ retry }));
  const rpc = vi.fn(() => ({ abortSignal }));
  return {
    abortSignal,
    retry,
    client: { rpc } as unknown as SupabaseClient<StorefrontDatabase>,
    rpc,
  };
}

describe('readStorefrontMerchantSnapshot', () => {
  it('uses the public GET RPC under one total deadline and returns found data', async () => {
    const row = {
      resolution_status: 'found',
      merchant_data: { id: 'merchant-1', slug: 'merchant-one' },
      custom_domain: 'merchant.example',
      feature_settings: { blog_enabled: true },
    };
    const { abortSignal, retry, client, rpc } = createClient({
      data: [row],
      error: null,
      status: 200,
    });

    const result = await readStorefrontMerchantSnapshot(
      client,
      'merchant.example'
    );

    expect(rpc).toHaveBeenCalledWith(
      'resolve_storefront_public_snapshot_v2',
      { p_identifier: 'merchant.example' },
      { get: true }
    );
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    // The bounded read must disable postgrest-js GET retries so the deadline
    // isn't extended by retry backoff on a TimeoutError.
    expect(retry).toHaveBeenCalledWith(false);
    expect(result).toEqual({ status: 'found', value: row });
  });

  it('returns not_found only from the explicit database status', async () => {
    const { client } = createClient({
      data: [
        {
          resolution_status: 'not_found',
          merchant_data: null,
          custom_domain: null,
          feature_settings: null,
        },
      ],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontMerchantSnapshot(client, 'missing-store')
    ).resolves.toEqual({ status: 'not_found' });
  });

  it('treats a successful empty RPC response as contract unavailability', async () => {
    const { client } = createClient({
      data: [],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontMerchantSnapshot(client, 'missing-store')
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({
        kind: 'integrity',
        retryable: false,
      }),
    });
  });

  it('returns unavailable instead of absence for statement timeouts', async () => {
    const { client } = createClient({
      data: null,
      error: { code: '57014', message: 'statement timeout' },
      status: 500,
    });

    await expect(
      readStorefrontMerchantSnapshot(client, 'merchant-one')
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({ kind: 'timeout', retryable: true }),
    });
  });

  it('classifies malformed found rows as integrity failures', async () => {
    const { client } = createClient({
      data: [
        {
          resolution_status: 'found',
          merchant_data: null,
          custom_domain: null,
          feature_settings: null,
        },
      ],
      error: null,
      status: 200,
    });

    await expect(
      readStorefrontMerchantSnapshot(client, 'merchant-one')
    ).resolves.toEqual({
      status: 'unavailable',
      error: expect.objectContaining({
        kind: 'integrity',
        retryable: false,
      }),
    });
  });
});
