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
const mockFrom = vi.fn(() => ({ select, insert }));

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
    merchantId: '550e8400-e29b-41d4-a716-446655440000',
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

describe('POST /api/staff', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCheckCsrfProtection.mockReset();
    mockAuthenticateApiRequest.mockReset();
    mockGetMerchantForApiRequest.mockReset();
    mockBuildStaffInviteEmail.mockReset();
    mockSendEmail.mockReset();
    lookupSingle.mockReset();
    insertSingle.mockReset();
    insertSelect.mockReset();
    insert.mockReset();
    lookupEqSecond.mockReset();
    lookupEqFirst.mockReset();
    select.mockReset();
    mockFrom.mockReset();
    insertSelect.mockImplementation(() => ({ single: insertSingle }));
    insert.mockImplementation(() => ({ select: insertSelect }));
    lookupEqSecond.mockImplementation(() => ({ single: lookupSingle }));
    lookupEqFirst.mockImplementation(() => ({ eq: lookupEqSecond }));
    select.mockImplementation(() => ({ eq: lookupEqFirst }));
    mockFrom.mockImplementation(() => ({ select, insert }));
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-1' },
      supabase: { from: mockFrom },
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: '550e8400-e29b-41d4-a716-446655440000',
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

  it('uses the requested merchant context and returns email delivery status', async () => {
    const { POST } = await import('@/app/api/staff/route');

    const request = new NextRequest('https://usebaci.com/api/staff', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-baci-merchant-id': '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({
        email: 'staff@example.com',
        role: 'sales_rep',
      }),
    });

    const response = await POST(request);

    expect(mockGetMerchantForApiRequest).toHaveBeenCalledWith(
      { from: mockFrom },
      'user-1',
      { requestedMerchantId: '550e8400-e29b-41d4-a716-446655440000' }
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      staff: { id: 'staff-1' },
      inviteUrl: 'https://usebaci.com/invite/token-123',
      invitationToken: expect.any(String),
      emailDelivery: {
        status: 'failed',
        error: 'Provider timeout',
      },
      message: 'Invitation created, but the email could not be delivered',
    });
  });

  it('rejects invalid merchant headers before doing any work', async () => {
    const { POST } = await import('@/app/api/staff/route');

    const request = new NextRequest('https://usebaci.com/api/staff', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-baci-merchant-id': 'not-a-uuid',
      },
      body: JSON.stringify({
        email: 'staff@example.com',
        role: 'sales_rep',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid merchant context',
    });
    expect(mockGetMerchantForApiRequest).not.toHaveBeenCalled();
  });
});
