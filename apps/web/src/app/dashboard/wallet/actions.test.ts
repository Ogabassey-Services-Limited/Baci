import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  })),
}));

const { getTransactions, getWalletData, updateWalletSettings } = await import(
  './actions'
);

function createQuery<TData>(result: { data: TData; error?: unknown }) {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  query.single.mockResolvedValue(result);

  return query;
}

describe('wallet actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({});
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
  });

  it('does not fetch wallet data for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await getWalletData('merchant-1');

    expect(result).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('does not fetch transactions for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await getTransactions('merchant-1');

    expect(result).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('does not update wallet settings for unauthenticated callers', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await updateWalletSettings('merchant-1', {
      autoPayoutEnabled: false,
    });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('verifies merchant ownership before updating wallet settings', async () => {
    const merchantQuery = createQuery({ data: { id: 'merchant-1' } });
    const walletUpdateEq = vi.fn(async () => ({ error: null }));
    const walletQuery = {
      update: vi.fn(() => ({ eq: walletUpdateEq })),
    };

    mocks.from.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }
      if (table === 'merchant_wallets') {
        return walletQuery;
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await updateWalletSettings('merchant-1', {
      autoPayoutDay: 'FRIDAY',
      minPayoutAmount: 5000,
    });

    expect(result).toEqual({ success: true });
    expect(merchantQuery.eq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(merchantQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(walletQuery.update).toHaveBeenCalledWith({
      auto_payout_day: 'friday',
      min_payout_amount: 5000,
    });
    expect(walletUpdateEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/wallet');
  });
});
