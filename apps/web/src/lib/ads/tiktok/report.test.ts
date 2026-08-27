import { describe, expect, it, vi } from 'vitest';
import { fetchTikTokAdsDailyReport } from './report';

const throttled = () =>
  new Response(JSON.stringify({ code: 40100 }), {
    headers: { 'retry-after': '6' },
    status: 429,
  });

describe('TikTok daily report retry budget', () => {
  it('shares one wait budget across paginated report requests', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(throttled())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { list: [], page_info: { page: 1, total_page: 2 } },
          })
        )
      )
      .mockResolvedValueOnce(throttled());
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      fetchTikTokAdsDailyReport(
        {
          accessToken: 'token',
          accountId: 'opaque-001',
          endDate: '2026-08-20',
          startDate: '2026-08-20',
        },
        fetchImpl,
        sleep
      )
    ).rejects.toMatchObject({
      code: 'TIKTOK_ADS_THROTTLED',
      status: 429,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(6_000);
  });
});
