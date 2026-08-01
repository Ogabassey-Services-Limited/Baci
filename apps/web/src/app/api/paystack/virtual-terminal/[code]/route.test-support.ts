import { NextRequest } from 'next/server';
import { vi } from 'vitest';

type MerchantContext = {
  merchantId: string;
  staffAccess: {
    isOwner: boolean;
    isStaff: boolean;
    role: string | null;
    permissions: Record<string, Record<string, boolean>>;
  };
};

const {
  mockAdminRpc,
  mockCheckCsrfProtection,
  mockDeactivateVirtualTerminal,
  mockFetchVirtualTerminal,
  mockFrom,
  mockGetMerchantForApiRequest,
  mockGetUser,
  mockRpc,
  mockSupabase,
  mockUpdateVirtualTerminal,
} = vi.hoisted(() => {
  const mockAdminRpc = vi.fn();
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();
  const mockRpc = vi.fn();

  return {
    mockAdminRpc,
    mockCheckCsrfProtection: vi.fn(),
    mockDeactivateVirtualTerminal: vi.fn(),
    mockFetchVirtualTerminal: vi.fn(),
    mockFrom,
    mockGetMerchantForApiRequest: vi.fn(),
    mockGetUser,
    mockRpc,
    mockSupabase: {
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
    },
    mockUpdateVirtualTerminal: vi.fn(),
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ rpc: mockAdminRpc })),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mockGetMerchantForApiRequest,
  toUserAccess: vi.fn((context: MerchantContext) => ({
    merchantId: context.merchantId,
    role: context.staffAccess.role,
    isOwner: context.staffAccess.isOwner,
    isStaff: context.staffAccess.isStaff,
    permissions: context.staffAccess.permissions,
  })),
}));

vi.mock('@/lib/paystack', () => ({
  deactivateVirtualTerminal: mockDeactivateVirtualTerminal,
  fetchVirtualTerminal: mockFetchVirtualTerminal,
  updateVirtualTerminal: mockUpdateVirtualTerminal,
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: mockCheckCsrfProtection }));

const { DELETE, GET, PUT } = await import('./route');

const TERMINAL_CODE = 'VT_TEST123';
const MERCHANT_ID = 'merchant-123';

function createRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest(
    `https://usebaci.com/api/paystack/virtual-terminal/${TERMINAL_CODE}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }
  );
}

function createParams() {
  return { params: Promise.resolve({ code: TERMINAL_CODE }) };
}

function createMerchantLookup(error: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error }),
  };
}

function setupDetailRouteTest() {
  vi.clearAllMocks();
  mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
  mockAdminRpc.mockResolvedValue({ data: 'terminal-1', error: null });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockGetMerchantForApiRequest.mockResolvedValue({
    merchantId: MERCHANT_ID,
    staffAccess: {
      isOwner: true,
      isStaff: false,
      role: null,
      permissions: { full_access: { all: true } },
    },
  });
  mockFrom.mockReturnValue(createMerchantLookup({ message: 'read failed' }));
}

export {
  createMerchantLookup,
  createParams,
  createRequest,
  DELETE,
  GET,
  MERCHANT_ID,
  mockAdminRpc,
  mockCheckCsrfProtection,
  mockDeactivateVirtualTerminal,
  mockFetchVirtualTerminal,
  mockFrom,
  mockGetMerchantForApiRequest,
  mockGetUser,
  mockRpc,
  mockUpdateVirtualTerminal,
  PUT,
  setupDetailRouteTest,
  TERMINAL_CODE,
};
