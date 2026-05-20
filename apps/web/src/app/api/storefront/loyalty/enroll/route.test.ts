import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn();

  return {
    mockFrom,
    mockSupabase: {
      from: mockFrom,
      rpc: vi.fn(),
    },
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { POST } from './route';

const MERCHANT_ID = 'merchant-123';
const CUSTOMER_ID = 'customer-123';

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('https://usebaci.com/api/storefront/loyalty/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createSingleQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createMaybeSingleQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

function createSettings() {
  return {
    id: 'settings-1',
    merchant_id: MERCHANT_ID,
    enabled: true,
    welcome_bonus: 10,
    referral_bonus_referee: 5,
    referral_bonus_referrer: 5,
  };
}

describe('POST /api/storefront/loyalty/enroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 when existing enrollment lookup fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'loyalty_settings') {
        return createSingleQuery(createSettings());
      }

      if (table === 'customer_loyalty') {
        return createMaybeSingleQuery(null, { message: 'read failed' });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({ merchant_id: MERCHANT_ID, customer_id: CUSTOMER_ID })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Failed to verify enrollment status' });
  });

  it('returns 500 when referral lookup fails', async () => {
    let loyaltyLookupCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'loyalty_settings') {
        return createSingleQuery(createSettings());
      }

      if (table === 'customer_loyalty') {
        loyaltyLookupCount += 1;
        if (loyaltyLookupCount === 1) {
          return createMaybeSingleQuery(null);
        }
        return createMaybeSingleQuery(null, {
          message: 'referral read failed',
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(
      createRequest({
        merchant_id: MERCHANT_ID,
        customer_id: CUSTOMER_ID,
        referral_code: 'REF123',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Database error verifying referral code',
    });
  });
});
