import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockListSavedPaymentMethods = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/customer-saved-payment-methods', () => ({
  listSavedPaymentMethods: (...args: unknown[]) =>
    mockListSavedPaymentMethods(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { GET } from './route';

describe('GET /api/vtu/checkout/saved-cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
    mockResolveVtuCustomer.mockResolvedValue({
      id: 'customer-1',
    });
    mockListSavedPaymentMethods.mockResolvedValue([
      {
        id: 'card-1',
        provider: 'paystack',
        label: 'Access Bank ending 1234',
        brand: 'visa',
        bank: 'Access Bank',
        last4: '1234',
        exp_month: '08',
        exp_year: '2030',
        is_default: true,
      },
    ]);
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'merchant-1' },
            error: null,
          }),
        }),
      }),
    }));
  });

  it('returns an empty list when no customer record exists', async () => {
    mockResolveVtuCustomer.mockResolvedValue(null);
    const request = new NextRequest(
      'http://localhost:3000/api/vtu/checkout/saved-cards?merchantSlug=ogabassey'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards).toEqual([]);
  });

  it('returns the saved cards for the authenticated customer', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/vtu/checkout/saved-cards?merchantSlug=ogabassey'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].label).toBe('Access Bank ending 1234');
  });
});
