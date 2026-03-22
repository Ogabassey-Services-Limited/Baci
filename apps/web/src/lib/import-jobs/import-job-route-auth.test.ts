import type { User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(),
  toUserAccess: vi.fn((context) => context.staffAccess),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { cookies } from 'next/headers';
import { hasPermission } from '@/lib/api-auth';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';
import {
  getImportJobForMerchant,
  hasImportRoutePermission,
  resolveImportRouteContext,
} from './import-job-route-auth';

describe('import-job-route-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
  });

  it('delegates import permissions to the route permission helper', () => {
    vi.mocked(hasPermission)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const allowed = hasImportRoutePermission(
      {
        merchantId: 'merchant-1',
        staffAccess: {
          isOwner: false,
          isStaff: true,
          role: 'manager',
          permissions: {},
        },
      } as never,
      'orders'
    );

    expect(allowed).toBe(true);
  });

  it('returns 401 when the merchant user is unauthenticated', async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);

    const result = await resolveImportRouteContext(
      new Request('http://localhost') as never
    );

    expect(result.context).toBeUndefined();
    expect(result.response?.status).toBe(401);
  });

  it('returns a merchant-scoped context when auth and permissions succeed', async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } as User },
        }),
      },
    } as never);
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      businessName: 'Ogabassey',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: {},
      },
    });

    const result = await resolveImportRouteContext(
      new Request('http://localhost') as never
    );

    expect(result.response).toBeUndefined();
    expect(result.context).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        merchantContext: expect.objectContaining({
          merchantId: 'merchant-1',
        }),
      })
    );
  });

  it('loads import jobs scoped to a merchant id', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'job-1',
        merchant_id: 'merchant-1',
        created_by: 'user-1',
        source_platform: 'bumpa',
        entity_type: 'orders',
        status: 'preview_ready',
        original_filename: 'orders.csv',
        storage_path: 'orders.csv',
        content_type: 'text/csv',
        file_size_bytes: 10,
        total_rows: 1,
        processed_rows: 1,
        summary: {},
        error: null,
        created_at: '2026-03-22T10:00:00.000Z',
      },
      error: null,
    });
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle,
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);

    const job = await getImportJobForMerchant(
      { from: vi.fn(() => query) } as never,
      'merchant-1',
      'job-1'
    );

    expect(job?.id).toBe('job-1');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'merchant_id', 'merchant-1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'id', 'job-1');
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
