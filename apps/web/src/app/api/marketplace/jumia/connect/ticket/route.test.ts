import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock('@/env', () => ({
  getConfiguredAppUrl: vi.fn(() => 'https://usebaci.com'),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TICKET_UUID = '00000000-0000-4000-8000-000000000099';
const MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

function makeRequest(): NextRequest {
  return new NextRequest(
    'http://localhost/api/marketplace/jumia/connect/ticket',
    {
      method: 'POST',
    }
  );
}

function setupAuth() {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: USER_ID },
    supabase: {},
    error: null,
  });
  mockGetUserAccess.mockResolvedValue({
    merchantId: MERCHANT_ID,
    role: 'owner',
  });
  mockHasPermission.mockReturnValue(true);
}

function setupAdminInsert() {
  mockAdminFrom.mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: TICKET_UUID,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          },
          error: null,
        }),
      }),
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

const { POST } = await import('./route');

describe('POST /api/marketplace/jumia/connect/ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      supabase: null,
      error: 'Unauthorized',
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 404 when merchant not found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: USER_ID },
      supabase: {},
      error: null,
    });
    mockGetUserAccess.mockResolvedValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
  });

  it('returns 403 when missing integrations:manage permission', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: USER_ID },
      supabase: {},
      error: null,
    });
    mockGetUserAccess.mockResolvedValue({
      merchantId: MERCHANT_ID,
      role: 'staff',
    });
    mockHasPermission.mockReturnValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it('creates ticket and returns authUrl on success', async () => {
    setupAuth();
    setupAdminInsert();

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ticket).toBe(TICKET_UUID);
    expect(body.authUrl).toContain('/api/marketplace/jumia/connect');
    expect(body.authUrl).toContain('ticket=');
    expect(body.authUrl).toContain('platform=mobile');
    expect(body.authUrl).toContain('connectionType=oauth');
  });

  it('returns 500 when database insert fails', async () => {
    setupAuth();
    mockAdminFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create ticket');
  });

  it('inserts ticket with correct merchant_id, user_id, and 60s TTL', async () => {
    setupAuth();
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: TICKET_UUID,
            expires_at: new Date(Date.now() + 60000).toISOString(),
          },
          error: null,
        }),
      }),
    });
    mockAdminFrom.mockReturnValue({ insert: mockInsert });

    await POST(makeRequest());

    expect(mockAdminFrom).toHaveBeenCalledWith('oauth_handoff_tickets');
    expect(mockInsert).toHaveBeenCalledOnce();
    const insertedRow = mockInsert.mock.calls[0][0];
    expect(insertedRow.merchant_id).toBe(MERCHANT_ID);
    expect(insertedRow.user_id).toBe(USER_ID);
    // expires_at should be ~60s from now
    const expiresAt = new Date(insertedRow.expires_at);
    const now = Date.now();
    expect(expiresAt.getTime()).toBeGreaterThan(now + 50000);
    expect(expiresAt.getTime()).toBeLessThan(now + 70000);
  });
});
