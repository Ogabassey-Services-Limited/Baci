import { describe, expect, it, vi } from 'vitest';
import {
  fetchMetaAdsDailyInsights,
  listMetaAdsAccounts,
  parseMetaAdsDailyInsights,
} from './provider';

describe('Meta Ads provider', () => {
  it('follows server-side account pagination and preserves canonical act_ ids', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'act_1',
                currency: 'NGN',
                name: 'First',
                timezone_name: 'Africa/Lagos',
              },
            ],
            paging: {
              next: 'https://graph.facebook.com/v25.0/me/adaccounts?after=next',
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'act_2',
                currency: 'USD',
                name: 'Second',
                timezone_name: 'America/New_York',
              },
            ],
          }),
          { status: 200 }
        )
      );
    await expect(
      listMetaAdsAccounts('access', fetchImpl)
    ).resolves.toMatchObject([{ accountId: 'act_1' }, { accountId: 'act_2' }]);
  });

  it('preserves exact decimal spend and provider-labelled action values', () => {
    expect(
      parseMetaAdsDailyInsights(
        {
          data: [
            {
              account_id: '12',
              date_start: '2026-08-20',
              date_stop: '2026-08-20',
              spend: '123.456789123',
              impressions: '10',
              clicks: '2',
              reach: '9',
              actions: [{ action_type: 'purchase', value: '1' }],
              action_values: [{ action_type: 'purchase', value: '99.95' }],
            },
          ],
        },
        'act_12'
      )
    ).toEqual([
      expect.objectContaining({
        spendAmountDecimal: '123.456789123',
        actions: [{ actionType: 'purchase', value: '1' }],
        actionValues: [{ actionType: 'purchase', value: '99.95' }],
      }),
    ]);
  });

  it('does not expose provider error bodies and retries throttles with bounded backoff', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 613, message: 'secret error body' },
          }),
          { status: 400 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { status: 200 })
      );
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(
      fetchMetaAdsDailyInsights(
        {
          accessToken: 'access',
          accountId: 'act_1',
          startDate: '2026-08-20',
          endDate: '2026-08-20',
        },
        fetchImpl,
        sleep
      )
    ).resolves.toEqual([]);
    expect(sleep).toHaveBeenCalledOnce();
  });
});
