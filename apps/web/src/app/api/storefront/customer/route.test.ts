import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';

// --- Mocks ---

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// --- Helpers ---

function makeRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/storefront/customer', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function mockChain(returnValue: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(returnValue),
    // The merchant lookup now goes through resolveMerchantIdBySlugOrAlias, which
    // uses maybeSingle (with a merchant_slug_aliases fallback on a miss).
    maybeSingle: vi.fn().mockResolvedValue(returnValue),
    update: vi.fn().mockReturnThis(),
  };
  // update().eq() should resolve to returnValue for update calls
  return chain;
}

// --- Tests ---

describe('PATCH /api/storefront/customer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = makeRequest({ merchantSlug: 'test-store' });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when merchantSlug is missing', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = makeRequest({ first_name: 'John' });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when saved_addresses has invalid structure', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = makeRequest({
      merchantSlug: 'test-store',
      saved_addresses: [{ label: 'Home' }], // missing required fields
    });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('returns 200 on valid PATCH with optional fields', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const merchantChain = mockChain({
      data: { id: 'merchant-1' },
      error: null,
    });
    const customerChain = mockChain({
      data: { id: 'customer-1' },
      error: null,
    });
    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return merchantChain;
      if (table === 'customers') {
        fromCallCount++;
        // First call: select customer, second call: update customer
        return fromCallCount === 1 ? customerChain : updateChain;
      }
      return merchantChain;
    });

    const request = makeRequest({
      merchantSlug: 'test-store',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+234800000000',
    });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      message: 'Profile updated successfully',
    });

    // Verify DB update was called with correct payload
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'John',
        last_name: 'Doe',
        phone: '+234800000000',
      })
    );
  });

  it('returns 200 on valid PATCH with saved_addresses', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const merchantChain = mockChain({
      data: { id: 'merchant-1' },
      error: null,
    });
    const customerChain = mockChain({
      data: { id: 'customer-1' },
      error: null,
    });
    const updateChain = {
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') return merchantChain;
      if (table === 'customers') {
        fromCallCount++;
        return fromCallCount === 1 ? customerChain : updateChain;
      }
      return merchantChain;
    });

    const validAddress = {
      id: 'addr-1',
      label: 'Home',
      full_name: 'John Doe',
      phone: '+234800000000',
      address: '123 Main St',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      postal_code: '100001',
      is_default: true,
    };

    const request = makeRequest({
      merchantSlug: 'test-store',
      saved_addresses: [validAddress],
    });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      message: 'Profile updated successfully',
    });

    // Verify DB update was called with saved_addresses
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        saved_addresses: [validAddress],
      })
    );
  });

  it('returns 400 on malformed JSON body', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new Request('http://localhost/api/storefront/customer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    }) as unknown as NextRequest;

    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid JSON');
  });
});
