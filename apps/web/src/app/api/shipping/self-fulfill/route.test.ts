import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getMerchantIdForApiUser: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { POST } from './route';

function createMockUser(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}

function createRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as NextRequest;
}

function createSupabaseMock() {
  const merchantSingle = vi.fn().mockResolvedValue({
    data: { self_fulfillment_enabled: true },
    error: null,
  });
  const orderSingle = vi.fn().mockResolvedValue({
    data: {
      id: 'order-1',
      merchant_id: 'merchant-1',
      shipping_status: 'processing',
      customer_name: 'Akinola Ogunniran',
      customer_phone: '+2348035962150',
      shipping_address: { address: 'Lekki Phase 1', city: 'Lekki' },
    },
    error: null,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const updateBuilder = {
    eq: vi.fn(() => updateBuilder),
  };
  updateBuilder.eq
    .mockImplementationOnce(() => updateBuilder)
    .mockImplementationOnce(updateEq);

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: merchantSingle,
            })),
          })),
        };
      }

      if (table === 'orders') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: orderSingle,
              })),
            })),
          })),
          update: vi.fn(() => updateBuilder),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    supabase: supabase as unknown as SupabaseClient,
    updateEq,
  };
}

describe('POST /api/shipping/self-fulfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
      response: undefined,
    });
    vi.mocked(getMerchantIdForApiUser).mockResolvedValue('merchant-1');
  });

  it('supports bearer-authenticated mobile staff requests', async () => {
    const { supabase, updateEq } = createSupabaseMock();

    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      user: createMockUser(),
      supabase,
    });

    const response = await POST(
      createRequest({
        orderId: '11111111-1111-1111-1111-111111111111',
        dispatchPhone: '+2348035962150',
        carrierName: 'Dispatch Rider',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(payload).toMatchObject({
      success: true,
      message: 'Order marked as self-fulfilled',
    });
  });

  it('returns 401 when api auth fails', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const response = await POST(
      createRequest({
        orderId: '11111111-1111-1111-1111-111111111111',
        dispatchPhone: '+2348035962150',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
  });
});
