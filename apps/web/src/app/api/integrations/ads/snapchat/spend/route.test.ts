import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => auth(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));

import { GET } from './route';

describe('Snapchat Ads spend route', () => {
  it('does not expose reporting rows without authentication', async () => {
    auth.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/snapchat/spend'
          )
        )
      ).status
    ).toBe(401);
  });

  it('returns normalized safe spend metrics for an authenticated viewer', async () => {
    const connection = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { account_timezone: 'UTC' }, error: null }),
      select: vi.fn().mockReturnThis(),
    };
    const spend = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            account_timezone: 'UTC',
            attribution_metadata: { provider: 'snapchat_ads' },
            clicks: '2',
            conversions: '1',
            currency_code: 'USD',
            fetched_at: 'now',
            impressions: '5',
            provider_customer_id: 'ad',
            spend_amount_decimal: '1.2',
            spend_date: '2026-08-20',
            spend_micros: '1200000',
          },
        ],
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    auth.mockResolvedValue({
      error: null,
      supabase: {
        from: vi
          .fn()
          .mockReturnValueOnce(connection)
          .mockReturnValueOnce(spend),
      },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/integrations/ads/snapchat/spend?startDate=2026-08-20&endDate=2026-08-20'
      )
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.rows[0]).toMatchObject({
      clicksLabel: 'Swipe Ups',
      spendMicros: '1200000',
    });
    expect(JSON.stringify(body)).not.toContain('access_token');
  });
});
