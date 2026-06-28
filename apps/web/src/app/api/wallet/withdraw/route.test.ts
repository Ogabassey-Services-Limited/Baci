import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/admin';
import { POST } from './route';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('POST /api/wallet/withdraw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the user is not authenticated', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const request = new NextRequest(
      'http://localhost:3000/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: 'Unauthorized' });
    expect(checkCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF is invalid', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }),
      },
    } as any);

    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: 'CSRF validation failed' });
  });

  it('returns 404 when CSRF is valid because withdrawals are disabled', async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }),
      },
    } as any);

    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
      response: undefined,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/wallet/withdraw',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 100 }),
      }
    );

    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: 'Not found' });
  });
});
