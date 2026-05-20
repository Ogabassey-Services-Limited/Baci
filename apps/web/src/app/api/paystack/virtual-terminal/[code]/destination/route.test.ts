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
  mockAssignVirtualTerminalDestinations,
  mockFrom,
  mockGetMerchantForApiRequest,
  mockGetUser,
  mockSupabase,
  mockUnassignVirtualTerminalDestinations,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockGetUser = vi.fn();

  return {
    mockAssignVirtualTerminalDestinations: vi.fn(),
    mockFrom,
    mockGetMerchantForApiRequest: vi.fn(),
    mockGetUser,
    mockSupabase: {
      auth: { getUser: mockGetUser },
      from: mockFrom,
    },
    mockUnassignVirtualTerminalDestinations: vi.fn(),
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
  assignVirtualTerminalDestinations: mockAssignVirtualTerminalDestinations,
  unassignVirtualTerminalDestinations: mockUnassignVirtualTerminalDestinations,
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

import { DELETE, POST } from './route';

const TERMINAL_CODE = 'VT_TEST123';
const MERCHANT_ID = 'merchant-123';

function createRequest(method: string, body: Record<string, unknown>) {
  return new NextRequest(
    `https://usebaci.com/api/paystack/virtual-terminal/${TERMINAL_CODE}/destination`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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

describe('/api/paystack/virtual-terminal/[code]/destination', () => {
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

  it('returns 500 when POST cannot verify terminal ownership', async () => {
    const response = await POST(
      createRequest('POST', {
        destinations: [{ target: '+2348012345678', name: 'Sales' }],
      }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockAssignVirtualTerminalDestinations).not.toHaveBeenCalled();
  });

  it('returns 500 when DELETE cannot verify terminal ownership', async () => {
    const response = await DELETE(
      createRequest('DELETE', { targets: ['+2348012345678'] }),
      createParams()
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Database error verifying terminal ownership',
    });
    expect(mockUnassignVirtualTerminalDestinations).not.toHaveBeenCalled();
  });
});
