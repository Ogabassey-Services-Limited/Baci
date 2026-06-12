import { generateText } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enhanceProductImage } from './enhance-product-images';

const { mockEnsurePermission, mockGetUser } = vi.hoisted(() => ({
  mockEnsurePermission: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: mockEnsurePermission,
  isMerchantPermissionRedirectError: (error: unknown): boolean =>
    error instanceof Error && error.name === 'MerchantPermissionDeniedError',
}));

vi.mock('../provider', () => ({
  gemini25FlashImage: 'test-image-model',
  withRetry: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

const mockGenerateText = vi.mocked(generateText);

const VALID_INPUT = {
  photoDataUri: 'data:image/png;base64,aGVsbG8=',
};

function authenticate() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
}

describe('enhanceProductImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsurePermission.mockResolvedValue({
      merchant: { id: 'merchant-1' },
      staffAccess: { isOwner: true },
    });
  });

  it('rejects unauthenticated callers without invoking the AI model', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(enhanceProductImage(VALID_INPUT)).rejects.toThrow(
      'You must be signed in to enhance product images.'
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(mockEnsurePermission).not.toHaveBeenCalled();
  });

  it('rejects callers when the auth lookup errors', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    await expect(enhanceProductImage(VALID_INPUT)).rejects.toThrow(
      'You must be signed in to enhance product images.'
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('rejects invalid image payloads before the permission check', async () => {
    authenticate();

    await expect(
      enhanceProductImage({ photoDataUri: 'https://example.com/a.png' })
    ).rejects.toThrow('Invalid product image provided for enhancement.');
    expect(mockEnsurePermission).not.toHaveBeenCalled();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('rejects callers without product create permission', async () => {
    authenticate();
    const denied = new Error('Permission denied');
    denied.name = 'MerchantPermissionDeniedError';
    mockEnsurePermission.mockRejectedValueOnce(denied);

    await expect(enhanceProductImage(VALID_INPUT)).rejects.toThrow(
      'You do not have permission to enhance product images.'
    );
    expect(mockEnsurePermission).toHaveBeenCalledWith('products', 'create');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('propagates unexpected permission-check failures unchanged', async () => {
    authenticate();
    mockEnsurePermission.mockRejectedValueOnce(
      new Error('database unavailable')
    );

    await expect(enhanceProductImage(VALID_INPUT)).rejects.toThrow(
      'database unavailable'
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns the enhanced image data URI on success', async () => {
    authenticate();
    mockGenerateText.mockResolvedValueOnce({
      files: [{ mediaType: 'image/png', base64: 'abc123' }],
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await enhanceProductImage(VALID_INPUT);

    expect(result).toEqual({
      enhancedPhotoDataUri: 'data:image/png;base64,abc123',
    });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('throws a user-facing error when the AI returns no image', async () => {
    authenticate();
    mockGenerateText.mockResolvedValueOnce({
      files: [],
    } as unknown as Awaited<ReturnType<typeof generateText>>);

    await expect(enhanceProductImage(VALID_INPUT)).rejects.toThrow(
      'Failed to enhance product image. Please try again.'
    );
  });
});
