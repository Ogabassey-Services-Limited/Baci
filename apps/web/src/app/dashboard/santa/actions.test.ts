import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  from: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

const { getRecentInteractions, getSantaStats } = await import('./actions');

function createStatsQuery<TData>(result: { data: TData; error: unknown }) {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockResolvedValue(result);

  return query;
}

function createInteractionsQuery<TData>(result: {
  data: TData;
  error: unknown;
}) {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue(result);

  return query;
}

const zeroStats = {
  avg_discount: 0,
  total_chats: 0,
  total_revenue: 0,
  unique_sessions: 0,
  wishes_denied: 0,
  wishes_granted: 0,
};

describe('santa dashboard actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({});
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
  });

  it('returns zero stats before querying when the caller is unauthenticated', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await getSantaStats('merchant-1');

    expect(result).toEqual(zeroStats);
    expect(mocks.getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('returns no interactions before querying when merchant access is denied', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValueOnce(null);

    const result = await getRecentInteractions('merchant-1');

    expect(result).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('loads Santa stats for the authorized merchant context', async () => {
    const query = createStatsQuery({
      data: [
        {
          avg_discount: 10,
          total_chats: 2,
          total_revenue: 5000,
          unique_sessions: 1,
          wishes_denied: 0,
          wishes_granted: 1,
        },
      ],
      error: null,
    });
    mocks.from.mockReturnValue(query);

    const result = await getSantaStats('merchant-requested');

    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      'user-1',
      { requestedMerchantId: 'merchant-requested' }
    );
    expect(mocks.from).toHaveBeenCalledWith('santa_campaign_stats');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(result).toEqual({
      avg_discount: 10,
      total_chats: 2,
      total_revenue: 5000,
      unique_sessions: 1,
      wishes_denied: 0,
      wishes_granted: 1,
    });
  });

  it('loads recent Santa interactions for the authorized merchant context', async () => {
    const mockInteractions = [
      {
        approved_price: 4500,
        created_at: '2026-06-01T12:00:00Z',
        discount_percentage: 10,
        id: 'interaction-1',
        interaction_type: 'wish_granted',
        product_name: 'Toy Phone',
        santa_response: 'Ho ho ho',
        session_id: 'session-1',
        user_message: 'I want a phone',
      },
    ];
    const query = createInteractionsQuery({
      data: mockInteractions,
      error: null,
    });
    mocks.from.mockReturnValue(query);

    const result = await getRecentInteractions('merchant-requested', 10);

    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.any(Object),
      'user-1',
      { requestedMerchantId: 'merchant-requested' }
    );
    expect(mocks.from).toHaveBeenCalledWith('santa_interactions');
    expect(query.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(result).toEqual(mockInteractions);
  });
});
