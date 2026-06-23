import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { sendPayout } from '@/lib/korapay';
import { POST } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn().mockResolvedValue({ valid: true }),
}));

vi.mock('@/lib/korapay', () => ({
  sendPayout: vi.fn(),
}));

const mockSupabase = {
  auth: {
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
  },
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('POST /api/payouts/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    amount: 10000,
    currency: 'NGN',
    bank_code: '058',
    account_number: '0123456789',
  };

  const createRequest = (body: any) =>
    new Request('http://localhost:3000/api/payouts/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('adds merchant_id scoping to the payout_requests update on successful payout', async () => {
    (getMerchantForApiRequest as any).mockResolvedValue({
      merchantId: 'merchant-123',
      businessName: 'Test Business',
    });

    // Mock initial selects/rpcs
    const _mockSelectReturn = {
      data: { email: 'test@example.com' },
      single: vi.fn().mockReturnValue({ data: { email: 'test@example.com' } }),
    };
    const mockInsertReturn = {
      select: vi.fn().mockReturnValue({
        single: vi
          .fn()
          .mockResolvedValue({ data: { id: 'req-1' }, error: null }),
      }),
    };

    // Mock the update chain.
    const mockEqChain = { eq: vi.fn().mockReturnThis() };
    const mockUpdate = vi.fn().mockReturnValue(mockEqChain);

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'merchants')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { email: 'test@example.com' } }),
            }),
          }),
        };
      if (table === 'payout_requests') {
        return {
          insert: vi.fn().mockReturnValue(mockInsertReturn),
          update: mockUpdate,
        };
      }
      if (table === 'transactions')
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });

    mockSupabase.rpc.mockResolvedValue({ data: 20000 });

    (sendPayout as any).mockResolvedValue({
      success: true,
      data: { status: 'success' },
    });

    const req = createRequest(validPayload);
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Verify the update was called
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' })
    );

    // Crucially: Verify `.eq()` was chained twice (once for id, once for merchant_id)
    expect(mockEqChain.eq).toHaveBeenCalledWith('id', 'req-1');
    expect(mockEqChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(mockEqChain.eq).toHaveBeenCalledTimes(2);
  });

  it('adds merchant_id scoping to the payout_requests update on failed payout', async () => {
    (getMerchantForApiRequest as any).mockResolvedValue({
      merchantId: 'merchant-123',
      businessName: 'Test Business',
    });

    const mockInsertReturn = {
      select: vi.fn().mockReturnValue({
        single: vi
          .fn()
          .mockResolvedValue({ data: { id: 'req-1' }, error: null }),
      }),
    };

    // Mock the update chain.
    const mockEqChain = { eq: vi.fn().mockReturnThis() };
    const mockUpdate = vi.fn().mockReturnValue(mockEqChain);

    mockSupabase.from.mockImplementation((table) => {
      if (table === 'merchants')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: { email: 'test@example.com' } }),
            }),
          }),
        };
      if (table === 'payout_requests') {
        return {
          insert: vi.fn().mockReturnValue(mockInsertReturn),
          update: mockUpdate,
        };
      }
      return {};
    });

    mockSupabase.rpc.mockResolvedValue({ data: 20000 });

    (sendPayout as any).mockRejectedValue(new Error('Gateway error'));

    const req = createRequest(validPayload);
    const res = await POST(req);

    // The route catches the error and returns 500
    expect(res.status).toBe(500);

    // Verify the update to 'failed' status was called
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );

    // Crucially: Verify `.eq()` was chained twice (once for id, once for merchant_id)
    expect(mockEqChain.eq).toHaveBeenCalledWith('id', 'req-1');
    expect(mockEqChain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-123');
    expect(mockEqChain.eq).toHaveBeenCalledTimes(2);
  });
});
