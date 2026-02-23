import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test12nanoid'),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

const mockGetUser = vi.fn();
const mockGetUserAccess = vi.fn();
const mockCreateSignedUploadUrl = vi.fn();
const mockGetPublicUrl = vi.fn();

// Inline hasPermission logic to avoid async import in mock factory.
// This mirrors the real hasPermission in @/lib/api-auth — if the real
// implementation changes, this mock must be updated to match.
vi.mock('@/lib/api-auth', () => ({
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (
    access: {
      isOwner: boolean;
      permissions: Record<string, Record<string, boolean>>;
    },
    resource: string,
    action: string
  ): boolean => {
    if (access.isOwner) return true;
    if (access.permissions['*']?.['*']) return true;
    if (access.permissions['*']?.[action]) return true;
    if (access.permissions[resource]?.['*']) return true;
    return access.permissions[resource]?.[action] === true;
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    storage: {
      from: vi.fn(() => ({
        createSignedUploadUrl: mockCreateSignedUploadUrl,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}));

// Import after mocks are set up
const { getSignedUploadUrl } = await import('@/actions/blog-upload');

const validInput = {
  contentType: 'image/jpeg',
  fileSize: 1024,
};

const mockUser = { id: 'user-123' };
const mockAccess = {
  merchantId: 'merchant-456',
  role: 'owner',
  isOwner: true,
  isStaff: false,
  permissions: { '*': { '*': true } },
};

describe('getSignedUploadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: mockUser } });
    mockGetUserAccess.mockResolvedValue(mockAccess);
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { token: 'signed-token-abc' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://storage.example.com/media/merchant-456/blog/test12nanoid.jpg',
      },
    });
  });

  it('returns signed URL data on success', async () => {
    const result = await getSignedUploadUrl(validInput);

    expect(result).toEqual({
      token: 'signed-token-abc',
      path: 'merchant-456/blog/test12nanoid.jpg',
      publicUrl:
        'https://storage.example.com/media/merchant-456/blog/test12nanoid.jpg',
    });
  });

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getSignedUploadUrl(validInput);

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('returns error when getUser itself fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Network error' },
    });

    const result = await getSignedUploadUrl(validInput);

    expect(result).toEqual({ error: 'Authentication failed' });
  });

  it('returns error when merchant not found', async () => {
    mockGetUserAccess.mockResolvedValue(null);

    const result = await getSignedUploadUrl(validInput);

    expect(result).toEqual({ error: 'Merchant not found' });
  });

  it('returns error when user lacks marketing permission', async () => {
    mockGetUserAccess.mockResolvedValue({
      ...mockAccess,
      isOwner: false,
      permissions: { orders: { view: true } },
    });

    const result = await getSignedUploadUrl(validInput);

    expect(result).toEqual({ error: 'Permission denied' });
  });

  it('returns error for invalid content type', async () => {
    const result = await getSignedUploadUrl({
      ...validInput,
      contentType: 'application/pdf',
    });

    expect(result).toEqual({
      error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF',
    });
  });

  it('returns error for oversized file', async () => {
    const result = await getSignedUploadUrl({
      ...validInput,
      fileSize: 11 * 1024 * 1024,
    });

    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain(
      'exceeds maximum size'
    );
  });

  it('returns error when createSignedUploadUrl fails', async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'Storage error' },
    });

    const result = await getSignedUploadUrl(validInput);

    expect(result).toEqual({ error: 'Failed to generate upload URL' });
  });

  it('generates correct file path with merchant ID', async () => {
    await getSignedUploadUrl({
      ...validInput,
      contentType: 'image/png',
    });

    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(
      'merchant-456/blog/test12nanoid.png'
    );
  });
});
