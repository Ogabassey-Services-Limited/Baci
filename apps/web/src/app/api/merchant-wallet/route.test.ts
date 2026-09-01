import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));
const { GET } = await import('./route');
function merchantQuery(data: unknown, error: Error | null = null) {
  return {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data, error }) }),
    }),
  };
}

describe('GET /api/merchant-wallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
  });
  it('returns 401 before any database lookup', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await GET();
    expect(r.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('returns 403 for a non-owner', async () => {
    from.mockReturnValue(merchantQuery(null));
    const r = await GET();
    expect(r.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('redacts owner lookup errors', async () => {
    from.mockReturnValue(merchantQuery(null, new Error('secret db')));
    const r = await GET();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'Unable to load merchant' });
  });
  it('returns a numeric balance for an owner', async () => {
    from.mockReturnValue(merchantQuery({ id: 'm1' }));
    rpc.mockResolvedValue({
      data: [{ available_balance: '1250.50' }],
      error: null,
    });
    const r = await GET();
    expect(await r.json()).toEqual({
      availableBalance: 1250.5,
      currency: 'NGN',
    });
    expect(rpc).toHaveBeenCalledWith('get_wallet_summary', {
      p_merchant_id: 'm1',
    });
  });
  it('uses zero when the wallet row is missing', async () => {
    from.mockReturnValue(merchantQuery({ id: 'm1' }));
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await (await GET()).json()).toEqual({
      availableBalance: 0,
      currency: 'NGN',
    });
  });
  it('redacts RPC failures', async () => {
    from.mockReturnValue(merchantQuery({ id: 'm1' }));
    rpc.mockResolvedValue({ data: null, error: new Error('provider secret') });
    const r = await GET();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'Unable to load wallet' });
  });
});
