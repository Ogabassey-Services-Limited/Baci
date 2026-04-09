import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn(),
}));

import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMonnifyToken } from '@/lib/monnify';
import { POST } from './route';

const mockOwnerAccess = {
  merchantId: 'merchant-1',
  role: 'owner',
  isOwner: true,
  isStaff: false,
  permissions: {},
};

const mockStaffAccess = {
  ...mockOwnerAccess,
  role: 'staff',
  isOwner: false,
  isStaff: true,
};

const validNinBody = {
  nin: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
};

function makeRpcMock(error: unknown = null) {
  return vi.fn().mockResolvedValue({ error });
}

function makeSupabaseMock(rpcError: unknown = null) {
  return { rpc: makeRpcMock(rpcError) };
}

function makeRequest(body: unknown): NextRequest {
  return {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    nextUrl: new URL('http://localhost/api/merchant/verify-nin'),
    json: vi.fn().mockResolvedValue(body),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

function makeNinResponse(firstName: string, lastName: string) {
  return {
    requestSuccessful: true,
    responseBody: {
      nin: '12345678901',
      firstName,
      lastName,
      middleName: '',
      dateOfBirth: '1990-01-15',
      gender: 'M',
      mobileNumber: '08012345678',
    },
  };
}

describe('POST /api/merchant/verify-nin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(getMonnifyToken).mockResolvedValue('mock-token');
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: makeSupabaseMock(),
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(getUserAccess).mockResolvedValue(mockOwnerAccess);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getUserAccess).mockResolvedValue(mockStaffAccess);

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 400 when NIN validation fails (10 digits)', async () => {
    const res = await POST(makeRequest({ ...validNinBody, nin: '1234567890' }));

    expect(res.status).toBe(400);
  });

  it('returns 200 with verified: true when names match', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => makeNinResponse('John', 'Doe'),
    } as Response);

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_nin_verification',
      expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_nin: '12345678901',
      })
    );
  });

  it('returns 200 with verified: false when names do not match', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => makeNinResponse('Jane', 'Smith'),
    } as Response);

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: false });
  });

  it('returns 500 when Monnify API fails', async () => {
    vi.mocked(getMonnifyToken).mockRejectedValueOnce(new Error('Auth failed'));

    const res = await POST(makeRequest(validNinBody));

    expect(res.status).toBe(500);
  });
});
