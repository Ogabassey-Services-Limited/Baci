import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockCreateClient = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockHasPermission = vi.fn();

const existingSingle = vi.fn();
const existingEqMerchant = vi.fn(() => ({ single: existingSingle }));
const existingEqId = vi.fn(() => ({ eq: existingEqMerchant }));
const select = vi.fn(() => ({ eq: existingEqId }));

const updateSingle = vi.fn();
const updateSelect = vi.fn(() => ({ single: updateSingle }));
const updateEqMerchant = vi.fn(() => ({ select: updateSelect }));
const updateEqId = vi.fn(() => ({ eq: updateEqMerchant }));
const update = vi.fn(() => ({ eq: updateEqId }));

const getUser = vi.fn();
const mockFrom = vi.fn(() => ({ select, update }));

const MERCHANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = 'user-1';
const STAFF_ID = 'staff-1';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({
    merchantId: MERCHANT_ID,
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: { staff: { edit: true } },
  })),
}));

vi.mock('@/lib/staff-invite-email', () => ({
  buildStaffInviteEmail: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(),
}));

function resetDatabaseMocks() {
  existingSingle.mockReset();
  existingEqMerchant.mockReset();
  existingEqId.mockReset();
  select.mockReset();
  updateSingle.mockReset();
  updateSelect.mockReset();
  updateEqMerchant.mockReset();
  updateEqId.mockReset();
  update.mockReset();
  getUser.mockReset();
  mockFrom.mockReset();

  existingEqMerchant.mockImplementation(() => ({ single: existingSingle }));
  existingEqId.mockImplementation(() => ({ eq: existingEqMerchant }));
  select.mockImplementation(() => ({ eq: existingEqId }));
  updateSelect.mockImplementation(() => ({ single: updateSingle }));
  updateEqMerchant.mockImplementation(() => ({ select: updateSelect }));
  updateEqId.mockImplementation(() => ({ eq: updateEqMerchant }));
  update.mockImplementation(() => ({ eq: updateEqId }));
  mockFrom.mockImplementation(() => ({ select, update }));
}

function createPatchRequest(body: unknown = { name: 'Ada Sales' }) {
  return new NextRequest(`https://usebaci.com/api/staff/${STAFF_ID}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-baci-merchant-id': MERCHANT_ID,
    },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/staff/[id]', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCheckCsrfProtection.mockReset();
    mockCreateClient.mockReset();
    mockGetMerchantForApiRequest.mockReset();
    mockHasPermission.mockReset();
    resetDatabaseMocks();

    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockCreateClient.mockReturnValue({ auth: { getUser }, from: mockFrom });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: MERCHANT_ID,
      businessName: 'TGW Enterprise',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        role: null,
        permissions: { staff: { edit: true } },
      },
    });
    mockHasPermission.mockReturnValue(true);
    existingSingle.mockResolvedValue({ data: { id: STAFF_ID }, error: null });
    updateSingle.mockResolvedValue({
      data: { id: STAFF_ID, name: 'Ada Sales' },
      error: null,
    });
  });

  it('scopes the update mutation to the merchant after ownership lookup', async () => {
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createPatchRequest();

    const response = await PATCH(request, {
      params: Promise.resolve({ id: STAFF_ID }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      staff: { id: STAFF_ID, name: 'Ada Sales' },
    });
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({ from: mockFrom }),
      USER_ID,
      { requestedMerchantId: MERCHANT_ID }
    );
    expect(existingEqId).toHaveBeenCalledWith('id', STAFF_ID);
    expect(existingEqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(update).toHaveBeenCalledWith({ name: 'Ada Sales' });
    expect(updateEqId).toHaveBeenCalledWith('id', STAFF_ID);
    expect(updateEqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('returns 401 when no authenticated user is present', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createPatchRequest();

    const response = await PATCH(request, {
      params: Promise.resolve({ id: STAFF_ID }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body has no allowed update fields', async () => {
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createPatchRequest({ email: 'intruder@example.com' });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: STAFF_ID }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No valid fields to update',
    });
    expect(existingEqId).toHaveBeenCalledWith('id', STAFF_ID);
    expect(existingEqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 404 and skips mutation when the staff row is outside the merchant scope', async () => {
    existingSingle.mockResolvedValue({ data: null, error: null });
    const { PATCH } = await import('@/app/api/staff/[id]/route');
    const request = createPatchRequest({ name: 'Ada Sales' });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: STAFF_ID }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Staff member not found',
    });
    expect(existingEqId).toHaveBeenCalledWith('id', STAFF_ID);
    expect(existingEqMerchant).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
    expect(update).not.toHaveBeenCalled();
  });
});
