import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockHasPermission = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockToUserAccess = vi.fn();
const mockCookies = vi.fn();
const mockCreateClient = vi.fn();

const mockExistingSingle = vi.fn();
const mockUpdatedSingle = vi.fn();
const mockUpdatedSelect = vi.fn(() => ({ single: mockUpdatedSingle }));
const mockUpdatedEqMerchant = vi.fn(() => ({ select: mockUpdatedSelect }));
const mockUpdatedEqId = vi.fn(() => ({ eq: mockUpdatedEqMerchant }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdatedEqId }));
const mockExistingEqMerchant = vi.fn(() => ({ single: mockExistingSingle }));
const mockExistingEqId = vi.fn(() => ({ eq: mockExistingEqMerchant }));
const mockSelect = vi.fn(() => ({ eq: mockExistingEqId }));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}));
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: mockFrom,
};

vi.mock('next/headers', () => ({
  cookies: (...args: unknown[]) => mockCookies(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const { PATCH } = await import('./route');

function createPatchRequest(
  id: string,
  body: Record<string, unknown>
): NextRequest {
  return new Request(`http://localhost/api/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  }) as unknown as NextRequest;
}

describe('PATCH /api/staff/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCookies.mockResolvedValue({
      get: vi.fn(),
      getAll: vi.fn(),
      set: vi.fn(),
    });
    mockCreateClient.mockReturnValue(mockSupabase);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-a',
    });
    mockToUserAccess.mockReturnValue({});
    mockHasPermission.mockReturnValue(true);
    mockExistingSingle.mockResolvedValue({
      data: { id: 'staff-1' },
      error: null,
    });
    mockUpdatedSingle.mockResolvedValue({
      data: {
        id: 'staff-1',
        merchant_id: 'merchant-a',
        name: 'Updated Staff',
      },
      error: null,
    });
  });

  it('updates a staff member scoped to the authenticated merchant', async () => {
    const response = await PATCH(
      createPatchRequest('staff-1', { name: 'Updated Staff' }),
      {
        params: Promise.resolve({ id: 'staff-1' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated Staff' });
    expect(mockUpdatedEqId).toHaveBeenCalledWith('id', 'staff-1');
    expect(mockUpdatedEqMerchant).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-a'
    );
    expect(payload.staff.name).toBe('Updated Staff');
  });

  it('returns 404 and does not mutate when the staff row belongs to another merchant', async () => {
    mockExistingSingle.mockResolvedValue({
      data: null,
      error: { message: 'Row not found' },
    });

    const response = await PATCH(
      createPatchRequest('staff-b', { role: 'manager' }),
      {
        params: Promise.resolve({ id: 'staff-b' }),
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({ error: 'Staff member not found' });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdatedSingle).not.toHaveBeenCalled();
  });

  it('returns the csrf failure response before reading the route body', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'CSRF validation failed' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    });

    const response = await PATCH(
      createPatchRequest('staff-1', { name: 'Updated Staff' }),
      {
        params: Promise.resolve({ id: 'staff-1' }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when the user lacks staff edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await PATCH(
      createPatchRequest('staff-1', { name: 'Updated Staff' }),
      {
        params: Promise.resolve({ id: 'staff-1' }),
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(mockExistingSingle).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body contains no allowed update fields', async () => {
    const response = await PATCH(
      createPatchRequest('staff-1', { foo: 'bar' }),
      {
        params: Promise.resolve({ id: 'staff-1' }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No valid fields to update',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
