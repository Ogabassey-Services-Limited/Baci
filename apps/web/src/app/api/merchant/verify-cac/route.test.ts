import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateApiRequest,
  checkCsrfProtection,
  checkRateLimit,
  extractCACCertificateData,
  getMerchantForApiRequest,
  makeFormDataRequest,
  makeSupabaseMock,
  makeValidFile,
  resetVerifyCacMocks,
} from '@/test-support/verify-cac-route.test-support';

async function loadVerifyCacPost() {
  return (await import('./route')).POST;
}

describe('POST /api/merchant/verify-cac request validation', () => {
  let POST: typeof import('./route').POST;

  beforeEach(async () => {
    resetVerifyCacMocks();
    POST = await loadVerifyCacPost();
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(403);
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: '11111111-1111-4111-8111-111111111111',
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {},
        role: 'manager',
      },
    });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 429 when the provider quota is exceeded after authorization', async () => {
    vi.mocked(checkRateLimit)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(req.formData).toHaveBeenCalledTimes(1);
    expect(getMerchantForApiRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized multipart Content-Length before parsing or calling providers', async () => {
    const req = makeFormDataRequest({
      file: makeValidFile(),
      rcNumber: 'RC123456',
      approvedName: 'Baci Technologies',
    });
    req.headers.set('Content-Length', String(5 * 1024 * 1024 + 65_537));
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect(req.formData).not.toHaveBeenCalled();
    expect(getMerchantForApiRequest).not.toHaveBeenCalled();
    expect(extractCACCertificateData).not.toHaveBeenCalled();
  });

  it('rejects a non-owner before certificate extraction or verification writes', async () => {
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: '11111111-1111-4111-8111-111111111111',
      staffAccess: {
        isOwner: false,
        isStaff: true,
        permissions: {},
        role: 'manager',
      },
    });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(403);
    expect(extractCACCertificateData).not.toHaveBeenCalled();
  });

  it('rejects India merchants before consuming provider quota or uploading a document', async () => {
    const supabaseMock = makeSupabaseMock(null, null, 'IN');
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'CAC verification is only available for Nigerian merchants',
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(supabaseMock.storage.from).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('returns 400 when file is missing', async () => {
    const res = await POST(
      makeFormDataRequest({
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
  });

  it('returns 400 when file MIME type is invalid', async () => {
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(100, 'image/gif', 'cac.gif'),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('type'),
    });
  });

  it('returns 400 when file exceeds 5MB', async () => {
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(5 * 1024 * 1024 + 1, 'image/jpeg', 'big.jpg'),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('5MB'),
    });
  });

  it('returns 400 when file content does not match declared MIME type', async () => {
    const spoofedFile = new File([new Uint8Array(100).fill(0xaa)], 'cac.jpg', {
      type: 'image/jpeg',
    });
    const res = await POST(
      makeFormDataRequest({
        file: spoofedFile,
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies',
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('does not match'),
    });
  });

  it('returns 400 when rcNumber or approvedName is missing', async () => {
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: '',
        approvedName: '',
      })
    );
    expect(res.status).toBe(400);
  });
});
