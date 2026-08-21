import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const authenticate = vi.fn();
const access = vi.fn();
const permission = vi.fn();
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) => authenticate(...args),
  getUserAccess: (...args: unknown[]) => access(...args),
  hasPermission: (...args: unknown[]) => permission(...args),
}));

import { GET } from './route';

describe('TikTok Ads spend route', () => {
  it('does not disclose decimal spend or provider conversions without authentication', async () => {
    authenticate.mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/spend'
          )
        )
      ).status
    ).toBe(401);
  });

  it('requires analytics view permission before querying provider-labelled spend', async () => {
    authenticate.mockResolvedValue({
      error: null,
      supabase: {},
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(false);
    expect(
      (
        await GET(
          new NextRequest(
            'https://usebaci.com/api/integrations/ads/tiktok/spend'
          )
        )
      ).status
    ).toBe(403);
  });

  it('returns exact decimal provider-labelled spend to an authorized analytics reader', async () => {
    const query = {
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      select: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [
        {
          account_timezone: 'Africa/Lagos',
          attribution_metadata: { provider: 'tiktok_ads' },
          clicks: '2',
          conversions: '1',
          currency_code: 'NGN',
          fetched_at: '2026-08-20T00:00:00Z',
          impressions: '10',
          provider_customer_id: 'opaque-001',
          reach: '8',
          spend_amount_decimal: '1.000000001',
          spend_date: '2026-08-20',
        },
      ],
      error: null,
    });
    authenticate.mockResolvedValue({
      error: null,
      supabase: { from: vi.fn(() => query) },
      user: { id: 'user' },
    });
    access.mockResolvedValue({ merchantId: 'merchant' });
    permission.mockReturnValue(true);
    const response = await GET(
      new NextRequest('https://usebaci.com/api/integrations/ads/tiktok/spend')
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currencyCode: 'NGN',
      rows: [expect.objectContaining({ spendAmountDecimal: '1.000000001' })],
    });
  });
});
