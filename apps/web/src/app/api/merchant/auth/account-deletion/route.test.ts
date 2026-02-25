import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';
import { POST } from './route';

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    get: () => null,
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

interface MockSupabase {
  auth: { getUser: ReturnType<typeof vi.fn> };
  rpc: ReturnType<typeof vi.fn>;
}

describe('POST /api/merchant/auth/account-deletion', () => {
  let mockSupabase: MockSupabase;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      rpc: vi.fn(),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as never);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest(
      'http://localhost/api/merchant/auth/account-deletion',
      { method: 'POST' }
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails', async () => {
    // Auth passes but CSRF fails
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const request = new NextRequest(
      'http://localhost/api/merchant/auth/account-deletion',
      { method: 'POST' }
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it('returns 200 and deletes account when auth and CSRF pass', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });

    mockSupabase.rpc.mockResolvedValue({ error: null });

    const request = new NextRequest(
      'http://localhost/api/merchant/auth/account-deletion',
      { method: 'POST' }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_current_user');
  });

  it('returns 500 when RPC deletion fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });

    mockSupabase.rpc.mockResolvedValue({
      error: new Error('Database error'),
    });

    const request = new NextRequest(
      'http://localhost/api/merchant/auth/account-deletion',
      { method: 'POST' }
    );

    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Database error');
  });
});
