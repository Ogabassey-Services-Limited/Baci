import { NextRequest } from 'next/server';
import { vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockAdminFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock('next/headers', () => ({ cookies: vi.fn(() => ({})) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  hasPermission: vi.fn(() => true),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: vi.fn(
    (ctx: {
      merchantId: string;
      staffAccess: {
        isOwner: boolean;
        isStaff: boolean;
        role: string | null;
        permissions: Record<string, Record<string, boolean>>;
      };
    }) => ({
      merchantId: ctx.merchantId,
      role: ctx.staffAccess.role ?? (ctx.staffAccess.isOwner ? 'owner' : null),
      isOwner: ctx.staffAccess.isOwner,
      isStaff: ctx.staffAccess.isStaff,
      permissions: ctx.staffAccess.permissions,
    })
  ),
}));
vi.mock('@/lib/paystack', () => ({ createVirtualTerminal: vi.fn() }));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

const { createVirtualTerminal } = await import('@/lib/paystack');
const { POST } = await import('./route');

const selectedMerchantId = '22222222-2222-4222-8222-222222222222';

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/paystack/virtual-terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ merchantId: selectedMerchantId, ...body }),
  });
}

function setupPostRouteTest() {
  vi.clearAllMocks();
  mockGetMerchantForApiRequest.mockResolvedValue({
    merchantId: 'm-1',
    businessName: 'Test Biz',
    staffAccess: {
      isOwner: true,
      isStaff: false,
      role: null,
      permissions: { full_access: { all: true } },
    },
  });
  mockAuthenticateApiRequest.mockResolvedValue({
    error: null,
    user: { id: 'u-1' },
    supabase: mockSupabase,
  });
  mockRpc.mockResolvedValue({ data: null, error: null });
}

export {
  createPostRequest,
  createVirtualTerminal,
  mockAdminFrom,
  mockAuthenticateApiRequest,
  mockFrom,
  mockGetMerchantForApiRequest,
  mockGetUser,
  mockRpc,
  POST,
  selectedMerchantId,
  setupPostRouteTest,
};
