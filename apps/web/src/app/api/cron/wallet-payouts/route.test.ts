import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPayoutMerchantCommission = vi.fn();

const createWalletQuery = () => {
  const query = {
    eq: vi.fn(),
    gte: vi.fn(),
    select: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return query;
};

const mockWalletQuery = createWalletQuery();
const mockSupabase = {
  from: vi.fn(() => mockWalletQuery),
  rpc: vi.fn(),
};

vi.mock('@/env', () => ({
  getCronSecret: () => 'cron-secret',
}));

vi.mock('@/lib/kuda', () => ({
  payoutMerchantCommission: (...args: unknown[]) =>
    mockPayoutMerchantCommission(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => mockSupabase,
}));

import { GET, POST } from './route';

function cronRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/cron/wallet-payouts', {
    headers,
    method: 'POST',
  });
}

describe('/api/cron/wallet-payouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockWalletQuery, createWalletQuery());
    mockSupabase.from.mockReturnValue(mockWalletQuery);
    mockWalletQuery.gte.mockResolvedValue({ data: [], error: null });
  });

  it('returns 401 when cron authentication is missing', async () => {
    const response = await POST(cronRequest());

    expect(response.status).toBe(401);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('accepts lowercase bearer authorization for payout runs', async () => {
    const response = await POST(
      cronRequest({ authorization: 'bearer cron-secret' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      results: {
        processed: 0,
        successful: 0,
        failed: 0,
      },
    });
    expect(mockSupabase.from).toHaveBeenCalledWith('merchant_wallets');
  });

  it('keeps accepting legacy x-cron-secret requests', async () => {
    const response = await POST(
      cronRequest({ 'x-cron-secret': 'cron-secret' })
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('merchant_wallets');
  });

  it('accepts lowercase bearer authorization for manual GET fallback', async () => {
    const response = await GET(
      new Request('http://localhost/api/cron/wallet-payouts', {
        headers: { authorization: 'bearer cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockSupabase.from).toHaveBeenCalledWith('merchant_wallets');
  });
});
