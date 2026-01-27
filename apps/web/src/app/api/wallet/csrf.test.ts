import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as csrf from '@/lib/csrf';
import { PATCH } from './route';
import { POST as POST_WITHDRAW } from './withdraw/route';

// Mock env
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getRootDomain: () => 'localhost:3000',
}));

// Mock dependencies
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

// Mock Supabase
const createChainableMock = () => {
  const mock = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-id',
        user_id: 'test-user-id',
        bank_account_number: '1234567890',
        bank_code: '058',
        bank_account_name: 'Test Account',
      },
      error: null,
    }),
    update: vi.fn(() => mock),
    insert: vi.fn(() => mock),
  };
  return mock;
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    }),
  },
  from: vi.fn(() => createChainableMock()),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

// Mock Kuda payout (for withdraw)
vi.mock('@/lib/kuda', () => ({
  payoutMerchantCommission: vi.fn().mockResolvedValue({
    success: true,
    reference: 'ref-123',
    message: 'Success',
  }),
}));

describe('Wallet API CSRF Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/wallet', () => {
    it('should call checkCsrfProtection', async () => {
      // Setup mock for checkCsrfProtection
      const checkCsrfMock = vi.mocked(csrf.checkCsrfProtection);
      checkCsrfMock.mockResolvedValue({ valid: true });

      // Create a mock request
      const request = new NextRequest('http://localhost:3000/api/wallet', {
        method: 'PATCH',
        body: JSON.stringify({
          autoPayoutEnabled: false,
        }),
      });

      // Call the handler
      await PATCH(request);

      // Verify checkCsrfProtection was called
      expect(checkCsrfMock).toHaveBeenCalledWith(request);
    });
  });

  describe('POST /api/wallet/withdraw', () => {
    it('should call checkCsrfProtection', async () => {
      // Setup mock for checkCsrfProtection
      const checkCsrfMock = vi.mocked(csrf.checkCsrfProtection);
      checkCsrfMock.mockResolvedValue({ valid: true });

      // Create a mock request
      const request = new NextRequest(
        'http://localhost:3000/api/wallet/withdraw',
        {
          method: 'POST',
          body: JSON.stringify({
            amount: 5000,
          }),
        }
      );

      // Call the handler
      await POST_WITHDRAW(request);

      // Verify checkCsrfProtection was called
      expect(checkCsrfMock).toHaveBeenCalledWith(request);
    });
  });
});
