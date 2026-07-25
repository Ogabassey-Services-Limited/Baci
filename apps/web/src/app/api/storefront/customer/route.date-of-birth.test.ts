import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from './route';

// --- Mocks ---

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockCheckCsrfProtection = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
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

describe('PATCH /api/storefront/customer — date of birth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: a valid CSRF token. Individual tests override to exercise the
    // rejection path.
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
  });

  it('returns 400 when date_of_birth is not a real date', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = makeRequest({
      merchantSlug: 'test-store',
      date_of_birth: '1990-02-30', // Feb 30 is not a real date
    });
    const response = await PATCH(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid input');
  });

  it('saves a valid date_of_birth (powers the quiz 18+ gate)', async () => {
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

    const request = makeRequest({
      merchantSlug: 'test-store',
      date_of_birth: '1990-06-15',
    });
    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ date_of_birth: '1990-06-15' })
    );
  });
});
