import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLiveBuildCache,
  readLatestLiveBuild,
  writeLatestLiveBuild,
} from './mobile-release-gate-store';

function makeReadClient(result: {
  data?: { latest_live_build: number } | null;
  error?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  const eqPlatform = vi.fn(() => ({ maybeSingle }));
  const eqApp = vi.fn(() => ({ eq: eqPlatform }));
  const select = vi.fn(() => ({ eq: eqApp }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, maybeSingle };
}

function makeAppScopedReadClient(
  results: Record<string, { latest_live_build: number }>
) {
  const queries: Record<string, string>[] = [];
  const currentQuery: Record<string, string> = {};
  const maybeSingle = vi.fn().mockImplementation(() => {
    queries.push({ ...currentQuery });
    const key = `${currentQuery.app}:${currentQuery.platform}`;
    return Promise.resolve({
      data: results[key] ?? null,
      error: null,
    });
  });
  const eq = vi.fn((column: string, value: string) => {
    currentQuery[column] = value;
    return chain;
  });
  const select = vi.fn(() => {
    for (const key of Object.keys(currentQuery)) {
      delete currentQuery[key];
    }
    return chain;
  });
  const chain = { eq, maybeSingle, select };
  const from = vi.fn(() => chain);
  return {
    client: { from } as unknown as SupabaseClient,
    maybeSingle,
    queries,
  };
}

describe('readLatestLiveBuild', () => {
  beforeEach(() => {
    __resetLiveBuildCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    __resetLiveBuildCache();
  });

  it('returns the build stored in the DB', async () => {
    const { client } = makeReadClient({ data: { latest_live_build: 360 } });

    const result = await readLatestLiveBuild('storefront', 'ios', client);

    expect(result).toBe(360);
  });

  it('falls back to the LATEST_BUILD env var when the DB has no row', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_IOS_LATEST_BUILD', '371');
    const { client } = makeReadClient({ data: null });

    const result = await readLatestLiveBuild('storefront', 'ios', client);

    expect(result).toBe(371);
  });

  it('falls back to the admin env var when the DB has no row', async () => {
    vi.stubEnv('MOBILE_ADMIN_IOS_LATEST_BUILD', '22');
    const { client } = makeReadClient({ data: null });

    const result = await readLatestLiveBuild('admin', 'ios', client);

    expect(result).toBe(22);
  });

  it('falls back to env when the DB read errors', async () => {
    vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '646');
    const { client } = makeReadClient({ error: { message: 'boom' } });

    const result = await readLatestLiveBuild('storefront', 'android', client);

    expect(result).toBe(646);
  });

  it('preserves an Android DB live row when the env fallback is newer', async () => {
    vi.stubEnv('MOBILE_ADMIN_ANDROID_LATEST_BUILD', '125');
    const { client } = makeReadClient({ data: { latest_live_build: 120 } });

    const result = await readLatestLiveBuild('admin', 'android', client);

    expect(result).toBe(120);
  });

  it('keeps an iOS DB live row when the env fallback is newer', async () => {
    vi.stubEnv('MOBILE_ADMIN_IOS_LATEST_BUILD', '125');
    const { client } = makeReadClient({ data: { latest_live_build: 120 } });

    const result = await readLatestLiveBuild('admin', 'ios', client);

    expect(result).toBe(120);
  });

  it('keeps the DB value when the env fallback is older', async () => {
    vi.stubEnv('MOBILE_ADMIN_ANDROID_LATEST_BUILD', '119');
    const { client } = makeReadClient({ data: { latest_live_build: 120 } });

    const result = await readLatestLiveBuild('admin', 'android', client);

    expect(result).toBe(120);
  });

  it('returns null when neither DB nor env has a value', async () => {
    const { client } = makeReadClient({ data: null });

    const result = await readLatestLiveBuild('storefront', 'ios', client);

    expect(result).toBeNull();
  });

  it('caches the resolved value so repeat reads skip the DB', async () => {
    const { client, maybeSingle } = makeReadClient({
      data: { latest_live_build: 360 },
    });

    await readLatestLiveBuild('storefront', 'ios', client);
    await readLatestLiveBuild('storefront', 'ios', client);

    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('keeps app-scoped reads and cache entries isolated for the same platform', async () => {
    const { client, maybeSingle, queries } = makeAppScopedReadClient({
      'storefront:ios': { latest_live_build: 360 },
      'admin:ios': { latest_live_build: 42 },
    });

    await expect(
      readLatestLiveBuild('storefront', 'ios', client)
    ).resolves.toBe(360);
    await expect(readLatestLiveBuild('admin', 'ios', client)).resolves.toBe(42);

    expect(maybeSingle).toHaveBeenCalledTimes(2);
    expect(queries).toEqual([
      { app: 'storefront', platform: 'ios' },
      { app: 'admin', platform: 'ios' },
    ]);
  });
});

describe('writeLatestLiveBuild', () => {
  afterEach(() => {
    __resetLiveBuildCache();
  });

  it('upserts the live build keyed on app+platform', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as unknown as SupabaseClient;

    await writeLatestLiveBuild(
      {
        app: 'storefront',
        platform: 'ios',
        build: 372,
        source: 'app_store_connect',
      },
      client
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        app: 'storefront',
        platform: 'ios',
        latest_live_build: 372,
        source: 'app_store_connect',
      }),
      { onConflict: 'app,platform' }
    );
  });

  it('throws when the upsert fails', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'denied' } });
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as unknown as SupabaseClient;

    await expect(
      writeLatestLiveBuild(
        {
          app: 'storefront',
          platform: 'ios',
          build: 372,
          source: 'app_store_connect',
        },
        client
      )
    ).rejects.toThrow('denied');
  });

  it('refreshes the cache so a subsequent read returns the written value', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as unknown as SupabaseClient;

    await writeLatestLiveBuild(
      {
        app: 'storefront',
        platform: 'ios',
        build: 400,
        source: 'app_store_connect',
      },
      client
    );

    const readClient = {
      from: vi.fn(() => {
        throw new Error('cache miss should not read the DB');
      }),
    } as unknown as SupabaseClient;

    await expect(
      readLatestLiveBuild('storefront', 'ios', readClient)
    ).resolves.toBe(400);
  });
});
