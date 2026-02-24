import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

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

    // Currently, without validation, this test is expected to fail.
    // The code will try to delete 'merchant-123/../../secret.txt'
    // and return success (assuming mock remove succeeds).
    // Once fixed, it should return 400.

    // If the vulnerability exists, the remove function WILL be called with the traversed path.
    // We want to assert that it IS NOT called.
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
});
