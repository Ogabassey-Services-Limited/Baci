import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockBuildStaffInviteEmail = vi.fn();
const mockSendEmail = vi.fn();

const lookupSingle = vi.fn();
const insertSingle = vi.fn();
const insertSelect = vi.fn(() => ({ single: insertSingle }));
const insert = vi.fn(() => ({ select: insertSelect }));
const lookupEqSecond = vi.fn(() => ({ single: lookupSingle }));
const lookupEqFirst = vi.fn(() => ({ eq: lookupEqSecond }));
const select = vi.fn(() => ({ eq: lookupEqFirst }));
const updateSingle = vi.fn();
const updateSelect = vi.fn(() => ({ single: updateSingle }));
const updateEqSecond = vi.fn(() => ({ select: updateSelect }));
const updateEqFirst = vi.fn(() => ({ eq: updateEqSecond }));
const update = vi.fn(() => ({ eq: updateEqFirst }));
const mockFrom = vi.fn(() => ({ select, insert, update }));

const MERCHANT_ID = '550e8400-e29b-41d4-a716-446655440000';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
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
}));

vi.mock('@/lib/staff-invite-email', () => ({
  buildStaffInviteEmail: (...args: unknown[]) =>
    mockBuildStaffInviteEmail(...args),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

function resetDatabaseMocks() {
  lookupSingle.mockReset();
  insertSingle.mockReset();
  insertSelect.mockReset();
  insert.mockReset();
  lookupEqSecond.mockReset();
  lookupEqFirst.mockReset();
  select.mockReset();
  updateSingle.mockReset();
  updateSelect.mockReset();
  updateEqSecond.mockReset();
  updateEqFirst.mockReset();
  update.mockReset();
  mockFrom.mockReset();

  insertSelect.mockImplementation(() => ({ single: insertSingle }));
  insert.mockImplementation(() => ({ select: insertSelect }));
  lookupEqSecond.mockImplementation(() => ({ single: lookupSingle }));
  lookupEqFirst.mockImplementation(() => ({ eq: lookupEqSecond }));
  select.mockImplementation(() => ({ eq: lookupEqFirst }));
  updateSelect.mockImplementation(() => ({ single: updateSingle }));
  updateEqSecond.mockImplementation(() => ({ select: updateSelect }));
  updateEqFirst.mockImplementation(() => ({ eq: updateEqSecond }));
  update.mockImplementation(() => ({ eq: updateEqFirst }));
  mockFrom.mockImplementation(() => ({ select, insert, update }));
}

function createRequest(
  body: unknown = {
    email: 'staff@example.com',
    role: 'sales_rep',
  },
  headers: Record<string, string> = {}
) {
  return new NextRequest('https://usebaci.com/api/staff', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/staff', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCheckCsrfProtection.mockReset();
    mockAuthenticateApiRequest.mockReset();
    mockGetMerchantForApiRequest.mockReset();
    mockBuildStaffInviteEmail.mockReset();
    mockSendEmail.mockReset();
    resetDatabaseMocks();

    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: { from: mockFrom },
    });
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
    lookupSingle.mockResolvedValue({ data: null, error: null });
    insertSingle.mockResolvedValue({
      data: { id: 'staff-1' },
      error: null,
    });
    mockBuildStaffInviteEmail.mockReturnValue({
      inviteUrl: 'https://usebaci.com/invite/token-123',
      email: {
        to: 'staff@example.com',
        subject: 'Invite',
        htmlContent: '<p>Invite</p>',
        textContent: 'Invite',
        emailType: 'team',
      },
    });
    mockSendEmail.mockResolvedValue({
      success: false,
      error: 'Provider timeout',
    });
  });

  it('uses the requested merchant context and redacts failed email delivery details', async () => {
    const { POST } = await import('@/app/api/staff/route');
    const request = createRequest(
      {
        email: 'staff@example.com',
        role: 'sales_rep',
      },
      { 'x-baci-merchant-id': MERCHANT_ID }
    );

    const response = await POST(request);

    expect(mockCheckCsrfProtection).toHaveBeenCalledWith(request);
    expect(mockAuthenticateApiRequest).toHaveBeenCalledWith(request);
    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      { from: mockFrom },
      'user-1',
      { requestedMerchantId: MERCHANT_ID }
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      staff: { id: 'staff-1' },
      inviteUrl: 'https://usebaci.com/invite/token-123',
      invitationToken: expect.any(String),
      emailDelivery: { status: 'failed' },
      message: 'Invitation created, but the email could not be delivered',
    });
  });

  it('returns sent delivery status when the provider accepts the email', async () => {
    const { POST } = await import('@/app/api/staff/route');
    mockSendEmail.mockResolvedValue({ success: true });

    const response = await POST(createRequest());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      staff: { id: 'staff-1' },
      inviteUrl: 'https://usebaci.com/invite/token-123',
      invitationToken: expect.any(String),
      emailDelivery: { status: 'sent' },
      message: 'Staff member invited successfully',
    });
  });

  it('scopes removed-staff reactivation updates to the merchant', async () => {
    const { POST } = await import('@/app/api/staff/route');
    lookupSingle.mockResolvedValue({
      data: { id: 'staff-removed-1', status: 'removed' },
      error: null,
    });
    updateSingle.mockResolvedValue({
      data: { id: 'staff-removed-1' },
      error: null,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        user_id: null,
      })
    );
    expect(updateEqFirst).toHaveBeenCalledWith('id', 'staff-removed-1');
    expect(updateEqSecond).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('returns 403 when csrf validation fails', async () => {
    const { POST } = await import('@/app/api/staff/route');
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: new Response(
        JSON.stringify({ error: 'CSRF validation failed' }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }
      ),
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'CSRF validation failed',
    });
    expect(mockAuthenticateApiRequest).not.toHaveBeenCalled();
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 401 when API authentication fails', async () => {
    const { POST } = await import('@/app/api/staff/route');
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is invalid', async () => {
    const { POST } = await import('@/app/api/staff/route');

    const response = await POST(
      createRequest({
        email: 'not-an-email',
        role: 'sales_rep',
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid email format',
    });
    expect(mockBuildStaffInviteEmail).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('rejects invalid merchant headers before doing any work', async () => {
    const { POST } = await import('@/app/api/staff/route');

    const response = await POST(
      createRequest(
        {
          email: 'staff@example.com',
          role: 'sales_rep',
        },
        { 'x-baci-merchant-id': 'not-a-uuid' }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid merchant context',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });
});
