import type { NextRequest } from 'next/server';
import { vi } from 'vitest';

export const authenticateApiRequest = vi.fn();
export const checkCsrfProtection = vi.fn();
export const checkRateLimit = vi.fn();
export const compareCACData = vi.fn();
export const extractCACCertificateData = vi.fn();
export const getMerchantForApiRequest = vi.fn();

vi.mock('@/lib/api-auth', () => ({ authenticateApiRequest }));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection }));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit }));
vi.mock('@/lib/verify-cac-certificate', () => ({
  extractCACCertificateData,
  compareCACData,
}));

function makeRpcMock(error: unknown = null) {
  return vi.fn().mockResolvedValue({ error });
}

export function makeSupabaseMock(
  uploadError: unknown = null,
  rpcError: unknown = null,
  country = 'NG'
) {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: { country },
    error: null,
  });

  const storageBucket = {
    upload: vi.fn().mockResolvedValue({ error: uploadError }),
    remove: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: merchantMaybeSingle })),
      })),
    })),
    merchantMaybeSingle,
    storage: {
      from: vi.fn(() => storageBucket),
    },
    storageBucket,
    rpc: makeRpcMock(rpcError),
  };
}

export function makeFormDataRequest(
  fields: Record<string, string | File | null>
): NextRequest {
  const formData = new FormData();
  formData.set('merchantId', '11111111-1111-4111-8111-111111111111');
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

export function makeValidFile(
  size = 100,
  type = 'image/jpeg',
  name = 'cac.jpg'
): File {
  const magic = MAGIC_BYTES[type] ?? [0x01];
  const buffer = new Uint8Array(Math.max(size, magic.length)).fill(1);
  magic.forEach((byte, index) => {
    buffer[index] = byte;
  });
  return new File([buffer], name, { type });
}

export function resetVerifyCacMocks() {
  vi.clearAllMocks();
  vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
  vi.mocked(checkRateLimit).mockResolvedValue(true);
  vi.mocked(authenticateApiRequest).mockResolvedValue({
    user: { id: 'user-1' },
    error: null,
    supabase: makeSupabaseMock(),
  } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
  vi.mocked(getMerchantForApiRequest).mockResolvedValue({
    merchantId: '11111111-1111-4111-8111-111111111111',
    staffAccess: {
      isOwner: true,
      isStaff: false,
      permissions: { full_access: { all: true } },
      role: null,
    },
  });
  vi.mocked(extractCACCertificateData).mockResolvedValue({
    documentType: 'Certificate of Incorporation',
    rcNumber: 'RC123456',
    businessName: 'BACI TECHNOLOGIES LTD',
  });
  vi.mocked(compareCACData).mockReturnValue({ match: true });
}
