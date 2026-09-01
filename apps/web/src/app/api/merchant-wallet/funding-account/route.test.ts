import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const from = vi.fn();
const getAccount = vi.fn();
const requestAccount = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from })),
}));
vi.mock('@/lib/merchant-wallet-payment-accounts', () => ({
  getMerchantWalletAccount: getAccount,
  requestMerchantWalletAccount: requestAccount,
}));
const { GET, POST } = await import('./route');
const getHandler = GET as () => Promise<Response>;
const postHandler = POST as (request: Request) => Promise<Response>;
function ownerQuery(data: unknown, error: Error | null = null) {
  return {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data, error }) }),
    }),
  };
}
function req(body: unknown): Request {
  return new Request('http://localhost/api/merchant-wallet/funding-account', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}
describe('funding account handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'u@example.com' } },
    });
    from.mockReturnValue(
      ownerQuery({
        id: 'm1',
        business_name: 'Shop',
        email: 'merchant@example.com',
      })
    );
  });
  it('authenticates before parsing malformed JSON', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const r = await postHandler(
      new Request('http://x', { method: 'POST', body: '{' })
    );
    expect(r.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('returns 400 for malformed JSON', async () => {
    const r = await postHandler(
      new Request('http://x', { method: 'POST', body: '{' })
    );
    expect(r.status).toBe(400);
    expect(requestAccount).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    false,
    'yes',
    null,
  ])('rejects invalid consent', async (consent) => {
    const r = await postHandler(req(consent === undefined ? {} : { consent }));
    expect(r.status).toBe(400);
  });
  it('returns 403 for a non-owner', async () => {
    from.mockReturnValue(ownerQuery(null));
    const r = await postHandler(req({ consent: true }));
    expect(r.status).toBe(403);
    expect(requestAccount).not.toHaveBeenCalled();
  });
  it('returns owner lookup error safely', async () => {
    from.mockReturnValue(ownerQuery(null, new Error('secret')));
    const r = await getHandler();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: 'Unable to load merchant' });
  });
  it('returns existing active account with safe fields', async () => {
    getAccount.mockResolvedValue({
      accountNumber: '1234567890',
      accountName: 'Shop',
      bankName: 'Bank',
      currency: 'NGN',
      status: 'active',
    });
    const r = await getHandler();
    expect(await r.json()).toEqual({
      account: expect.objectContaining({
        accountNumber: '1234567890',
        status: 'active',
      }),
    });
  });
  it('returns null account while assignment is pending', async () => {
    requestAccount.mockResolvedValue({ account: null, status: 'pending' });
    const r = await postHandler(req({ consent: true }));
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ account: null, status: 'pending' });
  });
  it('returns active assignment immediately when helper finds one', async () => {
    requestAccount.mockResolvedValue({
      account: { accountNumber: '1234567890', status: 'active' },
      status: 'active',
    });
    const r = await postHandler(req({ consent: true }));
    expect(r.status).toBe(200);
  });
  it('maps provider failure to 502 and redacts body', async () => {
    requestAccount.mockRejectedValue(new Error('Paystack secret body'));
    const r = await postHandler(req({ consent: true }));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({
      error: 'Unable to start funding account assignment',
    });
  });
  it('uses only the regular server client', async () => {
    requestAccount.mockResolvedValue({ account: null, status: 'pending' });
    await POST(req({ consent: true }));
    expect(
      (await import('@/lib/supabase/server')).createClient
    ).toHaveBeenCalled();
  });
});
