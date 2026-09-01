import { describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from, rpc })),
}));
const { GET } = await import('./route');

describe('merchant wallet route contract', () => {
  it('returns 401 before lookup', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await GET();
    expect(r.status).toBe(401);
  });
  it('returns balance and currency', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u' } } });
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'm' }, error: null }),
        }),
      }),
    });
    rpc.mockResolvedValue({ data: [{ available_balance: 5 }], error: null });
    expect(await (await GET()).json()).toEqual({
      availableBalance: 5,
      currency: 'NGN',
    });
  });
  it('redacts RPC failure', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('secret') });
    const r = await GET();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'Unable to load wallet' });
  });
});
