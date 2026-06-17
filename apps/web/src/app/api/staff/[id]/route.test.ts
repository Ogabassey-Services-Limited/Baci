import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();

const lookupSingle = vi.fn();
const lookupEqSecond = vi.fn(() => ({ single: lookupSingle }));
const lookupEqFirst = vi.fn(() => ({ eq: lookupEqSecond }));
const lookupSelect = vi.fn(() => ({ eq: lookupEqFirst }));

const updateSingle = vi.fn();
const updateSelect = vi.fn(() => ({ single: updateSingle }));
const updateEqSecond = vi.fn(() => ({ select: updateSelect }));
const updateEqFirst = vi.fn(() => ({
  eq: updateEqSecond,
  select: updateSelect,
}));
const update = vi.fn(() => ({ eq: updateEqFirst }));
const mockFrom = vi.fn(() => ({ select: lookupSelect, update }));

const MERCHANT_ID = '550e8400-e29b-41d4-a716-446655440000';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
  })),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({
    merchantId: MERCHANT_ID,
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: { '*': { '*': true } },
  })),
  parseRequestedMerchantId: vi.fn(() => ({
    error: null,
    merchantId: MERCHANT_ID,
  })),
}));

function createRequest(
  body: unknown = {
    name: 'Updated Name',
  },
  headers: Record<string, string> = {}
) {
  return new NextRequest('https://usebaci.com/api/staff/staff-1', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/staff/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      businessName: 'TGW Enterprise',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { full_access: { all: true } },
      },
    });
    lookupSingle.mockResolvedValue({ data: { id: 'staff-1' }, error: null });
    updateSingle.mockResolvedValue({
      data: { id: 'staff-1', name: 'Updated Name' },
      error: null,
    });

    // Setup method chain for update: update -> eq -> eq -> select -> single
    updateSelect.mockReturnValue({ single: updateSingle });
    updateEqSecond.mockReturnValue({ select: updateSelect });
    updateEqFirst.mockReturnValue({
      eq: updateEqSecond,
      select: updateSelect,
    } as unknown as ReturnType<typeof updateEqFirst>);
    update.mockReturnValue({ eq: updateEqFirst });
    mockFrom.mockReturnValue({ select: lookupSelect, update });
  });

  it('scopes the update mutation to the merchant after ownership lookup', async () => {
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createRequest({ name: 'Updated Name' });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'staff-1' }),
    });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Name',
      })
    );
    expect(updateEqFirst).toHaveBeenCalledWith('id', 'staff-1');
    expect(updateEqSecond).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('returns 400 when there are no valid fields to update', async () => {
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createRequest({ invalidField: 'value' });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'staff-1' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No valid fields to update',
    });
  });

  it('returns 404 when staff member does not belong to the merchant', async () => {
    lookupSingle.mockResolvedValueOnce({ data: null, error: null });
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createRequest({ name: 'Updated Name' });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'staff-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Staff member not found',
    });
  });

  it('returns 401 when the user is not authenticated', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(() => ({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: mockFrom,
        rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
      })),
    }));

    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createRequest({ name: 'Updated Name' });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'staff-1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });
});
