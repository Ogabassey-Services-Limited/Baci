import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '@/app/api/media/route';

const mockCreateClient = vi.fn();
const mockCookies = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockToUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCheckCsrfProtection = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mockToUserAccess(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

// Mock Supabase storage
const mockRemove = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  remove: mockRemove,
}));

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    }),
  },
  storage: {
    from: mockStorageFrom,
  },
};

describe('DELETE /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockReturnValue(mockSupabase);
    mockCookies.mockReturnValue({
      get: vi.fn(),
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-123',
    });
    mockToUserAccess.mockReturnValue({});
    mockHasPermission.mockReturnValue(true);
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockRemove.mockResolvedValue({ error: null });
  });

  it('allows deletion of valid file ID', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/media?id=valid-file.jpg',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCheckCsrfProtection).toHaveBeenCalledWith(request);
    expect(mockStorageFrom).toHaveBeenCalledWith('media');
    expect(mockRemove).toHaveBeenCalledWith(['merchant-123/valid-file.jpg']);
  });

  it('rejects request with invalid CSRF token', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/media?id=valid-file.jpg',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('prevents path traversal in file ID', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/media?id=../../secret.txt',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);

    expect(mockRemove).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });

  it('prevents absolute path / root path attempts', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/media?id=/etc/passwd',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);

    expect(mockRemove).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
  });

  it('returns 400 when id query param is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/media', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('File ID required');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/media?id=valid-file.jpg',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('returns 500 when storage removal fails', async () => {
    mockRemove.mockResolvedValueOnce({
      error: { message: 'Storage error' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/media?id=valid-file.jpg',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Storage error');
  });
});
