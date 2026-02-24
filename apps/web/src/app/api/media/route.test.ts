import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '@/app/api/media/route';

const mockCreateServerClient = vi.fn();
const mockCookies = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockToUserAccess = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
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

// CSRF Protection Note:
// CSRF token validation for DELETE (and all non-GET methods) is enforced at
// the proxy middleware layer (proxy.ts), not within individual route handlers.
// These unit tests invoke the handler directly, bypassing the middleware stack,
// so CSRF is not testable at this level. Integration/E2E tests that go through
// the full middleware pipeline cover CSRF enforcement.
describe('DELETE /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClient.mockReturnValue(mockSupabase);
    mockCookies.mockReturnValue({
      get: vi.fn(),
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-123',
    });
    mockToUserAccess.mockReturnValue({});
    mockHasPermission.mockReturnValue(true);
    mockRemove.mockResolvedValue({ error: null });
  });

  it('allows deletion of valid file ID', async () => {
    const request = new Request(
      'http://localhost:3000/api/media?id=valid-file.jpg',
      {
        method: 'DELETE',
        headers: {
          Cookie: 'csrf_token=test-csrf-token',
          'x-csrf-token': 'test-csrf-token',
        },
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockStorageFrom).toHaveBeenCalledWith('media');
    expect(mockRemove).toHaveBeenCalledWith(['merchant-123/valid-file.jpg']);
  });

  it('prevents path traversal in file ID', async () => {
    const request = new Request(
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
    const request = new Request(
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
    const request = new Request('http://localhost:3000/api/media', {
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

    const request = new Request(
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

    const request = new Request(
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

  it('succeeds without CSRF headers because CSRF is enforced at proxy.ts, not the route handler', async () => {
    // This test documents that the DELETE handler itself does not check CSRF
    // tokens. CSRF protection is handled by proxy.ts middleware before the
    // request reaches the route handler. When invoking the handler directly
    // (as in unit tests), the absence of CSRF headers does not cause failure.
    const request = new Request(
      'http://localhost:3000/api/media?id=valid-file.jpg',
      {
        method: 'DELETE',
      }
    );

    const response = await DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
