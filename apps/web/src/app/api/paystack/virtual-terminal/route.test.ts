import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
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

vi.mock('@/lib/paystack', () => ({
  createVirtualTerminal: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

import { createVirtualTerminal } from '@/lib/paystack';
import { GET, POST } from './route';

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/paystack/virtual-terminal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createGetRequest(): NextRequest {
  return new NextRequest('http://localhost/api/paystack/virtual-terminal', {
    method: 'GET',
  });
}

function resetMerchantContext() {
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
}

describe('POST /api/paystack/virtual-terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMerchantContext();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'u-1' },
      supabase: mockSupabase,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(createPostRequest({ name: 'Test Terminal' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when merchant not found', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u-1' } },
    });
    mockGetMerchantForApiRequest.mockResolvedValue(null);
    const eqChain: Record<string, unknown> = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    eqChain.eq = vi.fn().mockReturnValue(eqChain);
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(eqChain),
      }),
    });

    const res = await POST(createPostRequest({ name: 'Test Terminal' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 when name is too short', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u-1' } },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'm-1', business_name: 'Test Biz' },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'm-1', business_name: 'Test Biz' },
            error: null,
          }),
        }),
      }),
    });

    const res = await POST(createPostRequest({ name: 'X' }));
    expect(res.status).toBe(400);
  });

  it('creates terminal successfully', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u-1' } },
    });

    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'term-1' },
          error: null,
        }),
      }),
    });
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'm-1',
                  business_name: 'Test Biz',
                  virtual_terminal_code: null,
                },
                error: null,
              }),
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'm-1',
                  business_name: 'Test Biz',
                  virtual_terminal_code: null,
                },
                error: null,
              }),
            }),
          }),
          update: updateMock,
        };
      }
      if (table === 'virtual_terminals') {
        return { insert: insertMock };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    vi.mocked(createVirtualTerminal).mockResolvedValue({
      success: true,
      data: {
        code: 'VT_TEST123',
        paymentMethods: [
          {
            type: 'dedicated_nuban',
            account_number: '1234567890',
            account_name: 'TEST BIZ',
            bank: 'Wema Bank',
          },
        ],
      },
    } as never);

    const res = await POST(createPostRequest({ name: 'Sales Terminal' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.terminal.code).toBe('VT_TEST123');
    expect(body.terminal.accountNumber).toBe('1234567890');
  });

  it('returns 400 when Paystack API fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u-1' } },
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'm-1', business_name: 'Test Biz' },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { id: 'm-1', business_name: 'Test Biz' },
            error: null,
          }),
        }),
      }),
    });

    vi.mocked(createVirtualTerminal).mockResolvedValue({
      success: false,
      error: 'Paystack rate limit exceeded',
      code: 'RATE_LIMIT',
    } as never);

    const res = await POST(createPostRequest({ name: 'Sales Terminal' }));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/paystack/virtual-terminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMerchantContext();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'u-1' },
      supabase: mockSupabase,
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      error: 'Unauthorized',
      user: null,
      supabase: null,
    });

    const res = await GET(createGetRequest());
    expect(res.status).toBe(401);
  });

  it('returns terminals for merchant owner', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u-1' } },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'merchants') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'm-1' },
                error: null,
              }),
              single: vi.fn().mockResolvedValue({
                data: { id: 'm-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'virtual_terminals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 't-1',
                    code: 'VT_001',
                    name: 'Main Terminal',
                    active: true,
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const res = await GET(createGetRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.terminals).toHaveLength(1);
    expect(body.terminals[0].code).toBe('VT_001');
  });
});
