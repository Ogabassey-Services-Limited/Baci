import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: vi.fn(() => true),
  toUserAccess: vi.fn((ctx) => ({
    merchantId: ctx.merchantId,
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: {},
  })),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: vi.fn(() =>
    Promise.resolve({
      merchantId: 'merchant-123',
      staffAccess: { isOwner: true },
    })
  ),
  toUserAccess: vi.fn((ctx) => ({
    merchantId: ctx.merchantId,
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: {},
  })),
}));

// Supabase mock
const removeMock = vi.fn().mockResolvedValue({ error: null });

const createMockSupabase = () => ({
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: { id: 'user-123' } },
        error: null,
      })
    ),
  },
  storage: {
    from: vi.fn(() => ({
      remove: removeMock,
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'url' } })),
    })),
  },
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => createMockSupabase()),
}));

// Import handler AFTER mocks
import { DELETE } from './route';

describe('DELETE /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('vulnerability check: prevents path traversal', async () => {
    // This test simulates a malicious request.
    const url = new URL('http://localhost:3000/api/media');
    url.searchParams.set('id', '../other-merchant/secret.png');
    const req = new NextRequest(url.toString(), { method: 'DELETE' });

    const res = await DELETE(req);

    // With the fix, remove MUST NOT be called with the malicious path
    expect(removeMock).not.toHaveBeenCalled();

    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('Invalid file ID');
  });

  it('allows valid file IDs', async () => {
    const url = new URL('http://localhost:3000/api/media');
    url.searchParams.set('id', 'valid-file-123.jpg');
    const req = new NextRequest(url.toString(), { method: 'DELETE' });

    const res = await DELETE(req);

    // Verify it proceeds to delete the correct file
    expect(removeMock).toHaveBeenCalledWith([
      'merchant-123/valid-file-123.jpg',
    ]);

    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
