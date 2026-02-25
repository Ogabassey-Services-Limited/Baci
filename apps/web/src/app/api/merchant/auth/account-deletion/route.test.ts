import { NextRequest } from 'next/server';
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

describe('POST /api/merchant/auth/account-deletion', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      rpc: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabase);
  });

  it('should fail if CSRF validation fails', async () => {
    // Mock CSRF failure
    (checkCsrfProtection as any).mockResolvedValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
        status: 403,
      }),
    });

    // Mock Auth success to ensure it's not failing on auth
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock RPC success
    mockSupabase.rpc.mockResolvedValue({ error: null });

    const request = new NextRequest(
      'http://localhost/api/merchant/auth/account-deletion',
      {
        method: 'POST',
      }
    );

    const response = await POST(request);

    // Expect 403 Forbidden due to CSRF failure
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Invalid CSRF token');
  });

  it('should proceed if CSRF validation passes', async () => {
    // Mock CSRF success
    (checkCsrfProtection as any).mockResolvedValue({
      valid: true,
    });

    // Mock Auth success
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock RPC success
    mockSupabase.rpc.mockResolvedValue({ error: null });

    const request = new NextRequest(
      'http://localhost/api/merchant/auth/account-deletion',
      {
        method: 'POST',
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_current_user');
  });
});
