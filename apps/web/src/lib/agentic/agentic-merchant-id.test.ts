import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetAgenticMerchantIdCache,
  resolveAgenticMerchantId,
} from './agentic-merchant-id';

const MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';

function createClient(result: {
  data: { id: string } | null;
  error?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: result.data,
    error: result.error ?? null,
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as Pick<SupabaseClient, 'from'>,
    from,
    select,
    eq,
    maybeSingle,
  };
}

describe('resolveAgenticMerchantId', () => {
  beforeEach(() => {
    resetAgenticMerchantIdCache();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
  });

  it('resolves the merchant id from the configured slug', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    const { client, from, select, eq } = createClient({
      data: { id: MERCHANT_ID },
    });

    const result = await resolveAgenticMerchantId(client);

    expect(result).toBe(MERCHANT_ID);
    expect(from).toHaveBeenCalledWith('merchants');
    // Least privilege: only the id, never a secret column.
    expect(select).toHaveBeenCalledWith('id');
    expect(eq).toHaveBeenCalledWith('slug', 'ogabassey');
  });

  it('memoizes so repeat copilot turns do not re-query', async () => {
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    const { client, maybeSingle } = createClient({ data: { id: MERCHANT_ID } });

    await resolveAgenticMerchantId(client);
    await resolveAgenticMerchantId(client);

    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('accepts the legacy OPENAI_ alias', async () => {
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    const { client } = createClient({ data: { id: MERCHANT_ID } });

    await expect(resolveAgenticMerchantId(client)).resolves.toBe(MERCHANT_ID);
  });

  describe('fails closed', () => {
    it('returns null when no slug is configured', async () => {
      const { client, from } = createClient({ data: { id: MERCHANT_ID } });

      const result = await resolveAgenticMerchantId(client);

      expect(result).toBeNull();
      // Must not query at all without a configured tenant.
      expect(from).not.toHaveBeenCalled();
    });

    it('returns null when the slug matches no merchant', async () => {
      vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'does-not-exist');
      const { client } = createClient({ data: null });

      await expect(resolveAgenticMerchantId(client)).resolves.toBeNull();
    });

    it('returns null when the lookup errors', async () => {
      vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
      const { client } = createClient({
        data: null,
        error: { message: 'permission denied' },
      });

      await expect(resolveAgenticMerchantId(client)).resolves.toBeNull();
    });

    it('does not cache a failed lookup', async () => {
      vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
      const failing = createClient({ data: null });
      await expect(
        resolveAgenticMerchantId(failing.client)
      ).resolves.toBeNull();

      const succeeding = createClient({ data: { id: MERCHANT_ID } });
      await expect(resolveAgenticMerchantId(succeeding.client)).resolves.toBe(
        MERCHANT_ID
      );
    });
  });
});
