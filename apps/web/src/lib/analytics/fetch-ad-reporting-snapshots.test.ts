import { describe, expect, it, vi } from 'vitest';
import { fetchAdReportingSnapshots } from './fetch-ad-reporting-snapshots';

function chainResult(
  result: { data: unknown; error: unknown },
  terminal: 'in' | 'maybeSingle' | 'order'
) {
  const chain: Record<string, unknown> = {};
  for (const method of ['eq', 'gte', 'in', 'lte', 'order', 'select']) {
    chain[method] = vi.fn(() =>
      method === terminal ? Promise.resolve(result) : chain
    );
  }
  chain.maybeSingle = () =>
    terminal === 'maybeSingle' ? Promise.resolve(result) : chain;
  return chain;
}

describe('fetchAdReportingSnapshots', () => {
  it('reads only credential-free Google and social projections', async () => {
    const results = [
      {
        data: {
          last_synced_at: null,
          provider_customer_id: 'google-1',
          status: 'active',
        },
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          {
            account_timezone: 'UTC',
            last_synced_at: null,
            provider: 'snapchat_ads',
            provider_account_label: 'Baci Snap',
            provider_customer_id: 'snap-1',
            status: 'active',
          },
        ],
        error: null,
      },
      { data: [], error: null },
    ];
    const terminals = ['maybeSingle', 'order', 'in', 'order'] as const;
    let index = 0;
    const from = vi.fn(() =>
      chainResult(
        results[index] ?? { data: [], error: null },
        terminals[index++]
      )
    );

    const result = await fetchAdReportingSnapshots({
      endDate: '2026-08-22',
      merchantId: 'merchant-1',
      startDate: '2026-08-01',
      supabase: { from } as never,
    });

    expect(result.googleAds).toMatchObject({ connected: true });
    expect(result.socialAds.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectionStatus: 'connected',
          provider: 'snapchat_ads',
        }),
      ])
    );
    const selectedColumns = from.mock.results.flatMap((call) => {
      const value = call.value as { select?: ReturnType<typeof vi.fn> };
      return value.select?.mock.calls.flat() ?? [];
    });
    expect(selectedColumns.join(' ')).not.toMatch(
      /access_token|refresh_token|secret|credential/i
    );
  });
});
