import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

vi.mock('@/env', () => ({
  isProduction: vi.fn(() => false),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

const ownerAccess = {
  merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
  isOwner: true,
  isStaff: false,
  role: 'owner',
  permissions: { '*': { '*': true } },
};

const staffAccess = {
  merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
  isOwner: false,
  isStaff: true,
  role: 'manager',
  permissions: { marketing: { edit: true } },
};

function createUploadRequest() {
  const formData = new FormData();
  formData.append(
    'file',
    new File(['image-bytes'], 'cover.png', { type: 'image/png' })
  );

  return {
    headers: new Headers({ host: 'localhost:3000' }),
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as Parameters<typeof POST>[0];
}

function createAuthedSupabaseMock(
  uploadError: { message: string } | null = null
) {
  const uploadMock = vi.fn().mockResolvedValue({ error: uploadError });
  const getPublicUrlMock = vi.fn((path: string) => ({
    data: { publicUrl: `https://example.com/${path}` },
  }));

  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { slug: 'test-store' },
              error: null,
            }),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          getPublicUrl: getPublicUrlMock,
        })),
      },
    },
    uploadMock,
    getPublicUrlMock,
  };
}

function mockAuthenticatedRequest(supabase: unknown) {
  mockAuthenticateApiRequest.mockResolvedValue({
    user: { id: 'user-1' },
    error: null,
    supabase,
  });
}

describe('POST /api/merchant/blog/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Vitest/jsdom File may not implement arrayBuffer in all environments.
    if (!File.prototype.arrayBuffer) {
      Object.defineProperty(File.prototype, 'arrayBuffer', {
        configurable: true,
        value: function arrayBuffer() {
          return Promise.resolve(new Uint8Array([1, 2, 3]).buffer);
        },
      });
    }

    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockHasPermission.mockReturnValue(true);
    mockGetUserAccess.mockResolvedValue(ownerAccess);

    mockCreateClient.mockReturnValue({
      storage: {
        from: vi.fn(),
      },
    });
  });

  it('returns a generic upload error and code when storage upload fails', async () => {
    mockGetUserAccess.mockResolvedValue(staffAccess);
    const { supabase, uploadMock } = createAuthedSupabaseMock({
      message: 'new row violates row-level security policy',
    });
    mockAuthenticatedRequest(supabase);

    const response = await POST(createUploadRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to upload file');
    expect(body.code).toBe('UPLOAD_FAILED');
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('allows staff with marketing edit permission to upload blog images', async () => {
    mockGetUserAccess.mockResolvedValue(staffAccess);
    mockHasPermission.mockReturnValue(true);
    const { supabase, uploadMock } = createAuthedSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await POST(createUploadRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.path).toContain(`${staffAccess.merchantId}/blog/`);
    expect(body.url).toContain(body.path);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when staff lacks marketing edit permission', async () => {
    mockGetUserAccess.mockResolvedValue(staffAccess);
    mockHasPermission.mockReturnValue(false);
    const { supabase, uploadMock } = createAuthedSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await POST(createUploadRequest());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Permission denied');
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('allows owner uploads to continue working', async () => {
    mockGetUserAccess.mockResolvedValue(ownerAccess);
    mockHasPermission.mockReturnValue(true);
    const { supabase, uploadMock } = createAuthedSupabaseMock();
    mockAuthenticatedRequest(supabase);

    const response = await POST(createUploadRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.path).toContain(`${ownerAccess.merchantId}/blog/`);
    expect(uploadMock).toHaveBeenCalledTimes(1);
  });
});
