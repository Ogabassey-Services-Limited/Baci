import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/verify-cac-certificate', () => ({
  extractCACCertificateData: vi.fn(),
  compareCACData: vi.fn(),
}));

import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  compareCACData,
  extractCACCertificateData,
} from '@/lib/verify-cac-certificate';
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

function makeRpcMock(error: unknown = null) {
  return vi.fn().mockResolvedValue({ error });
}

function makeSupabaseMock(
  uploadError: unknown = null,
  rpcError: unknown = null
) {
  return {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: uploadError }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    rpc: makeRpcMock(rpcError),
  };
}

function makeFormDataRequest(
  fields: Record<string, string | File | null>
): NextRequest {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) formData.set(key, value);
  }
  return {
    method: 'POST',
    headers: new Headers(),
    nextUrl: new URL('http://localhost/api/merchant/verify-cac'),
    formData: vi.fn().mockResolvedValue(formData),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};

function makeValidFile(
  size = 100,
  type = 'image/jpeg',
  name = 'cac.jpg'
): File {
  const magic = MAGIC_BYTES[type] ?? [0x01];
  const buffer = new Uint8Array(Math.max(size, magic.length)).fill(1);
  magic.forEach((byte, i) => {
    buffer[i] = byte;
  });
  return new File([buffer], name, { type });
}

describe('POST /api/merchant/verify-cac', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: makeSupabaseMock(),
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(getUserAccess).mockResolvedValue(mockOwnerAccess);
    vi.mocked(extractCACCertificateData).mockResolvedValue({
      documentType: 'Certificate of Incorporation',
      rcNumber: 'RC123456',
      businessName: 'BACI TECHNOLOGIES LTD',
    });
    vi.mocked(compareCACData).mockReturnValue({ match: true });
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getUserAccess).mockResolvedValue(mockStaffAccess);

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it('returns 400 when file is missing', async () => {
    const req = makeFormDataRequest({
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
  });

  it('returns 400 when file MIME type is invalid', async () => {
    const req = makeFormDataRequest({
      file: makeValidFile(100, 'image/gif', 'cac.gif'),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('type'),
    });
  });

  it('returns 400 when file exceeds 5MB', async () => {
    const bigFile = makeValidFile(5 * 1024 * 1024 + 1, 'image/jpeg', 'big.jpg');
    const req = makeFormDataRequest({
      file: bigFile,
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('5MB'),
    });
  });

  it('returns 400 when file content does not match declared MIME type', async () => {
    // File claims to be JPEG but has no valid magic bytes
    const spoofedFile = new File([new Uint8Array(100).fill(0xaa)], 'cac.jpg', {
      type: 'image/jpeg',
    });
    const req = makeFormDataRequest({
      file: spoofedFile,
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('does not match'),
    });
  });

  it('returns 400 when rcNumber or approvedName is missing', async () => {
    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: '',
      approvedName: '',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 200 with verified: true when CAC data matches', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(compareCACData).mockReturnValue({ match: true });

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies Ltd',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_cac_verification',
      expect.objectContaining({
        p_merchant_id: 'merchant-1',
        p_rc_number: 'RC123456',
        p_cac_approved_name: 'Baci Technologies Ltd',
      })
    );
  });

  it('returns 200 with verified: false and reason when data does not match', async () => {
    vi.mocked(compareCACData).mockReturnValue({
      match: false,
      reason: 'RC number mismatch',
    });

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC999999',
      approvedName: 'Baci Technologies Ltd',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
    expect(body.reason).toBe('RC number mismatch');
  });

  it('returns 500 when RPC throws', async () => {
    const supabaseMock = makeSupabaseMock(null, { message: 'DB error' });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies Ltd',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
