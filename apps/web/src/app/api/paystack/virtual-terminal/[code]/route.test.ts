import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  mockDeactivateVirtualTerminal,
  mockFetchVirtualTerminal,
  mockFrom,
  mockGetMerchantForApiRequest,
  mockGetUser,
  mockSupabase,
  mockUpdateVirtualTerminal,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();

  return {
    mockDeactivateVirtualTerminal: vi.fn(),
    mockFetchVirtualTerminal: vi.fn(),
    mockFrom,
    mockGetMerchantForApiRequest: vi.fn(),
    mockGetUser,
    mockSupabase: {
      auth: { getUser: mockGetUser },
      from: mockFrom,
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

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

import { DELETE, GET, PUT } from './route';

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

describe('/api/paystack/virtual-terminal/[code]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('returns 500 when GET cannot verify terminal ownership', async () => {
    const response = await GET(createRequest('GET'), createParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockFetchVirtualTerminal).not.toHaveBeenCalled();
  });

  it('returns 500 when PUT cannot verify terminal ownership', async () => {
    const response = await PUT(
      createRequest('PUT', { name: 'Sales Terminal' }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockUpdateVirtualTerminal).not.toHaveBeenCalled();
  });

  it('returns 500 when DELETE cannot verify terminal ownership', async () => {
    const response = await DELETE(createRequest('DELETE'), createParams());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockDeactivateVirtualTerminal).not.toHaveBeenCalled();
  });
});
