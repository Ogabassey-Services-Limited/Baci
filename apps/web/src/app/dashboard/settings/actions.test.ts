import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockGetMerchantForApiRequest = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  })),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mockGetMerchantForApiRequest(...args),
}));
vi.mock('@/lib/favicon-processor', () => ({
  processFavicon: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { processFavicon } from '@/lib/favicon-processor';
import { uploadFavicon } from './actions';

describe('uploadFavicon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockGetMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
  });

  it('returns error when no file in FormData', async () => {
    // Arrange
    const formData = new FormData();

    // Act
    const result = await uploadFavicon(formData, 'merchant-1');

    // Assert
    expect(result).toEqual({ success: false, error: 'No file provided' });
  });

  it('returns success when upload succeeds', async () => {
    // Arrange
    const faviconResult = {
      svg_url: 'https://cdn.example.com/favicon.svg',
      png_32_url: 'https://cdn.example.com/favicon-32.png',
      png_192_url: 'https://cdn.example.com/favicon-192.png',
      apple_touch_url: 'https://cdn.example.com/apple-touch.png',
    };
    vi.mocked(processFavicon).mockResolvedValue(faviconResult);

    const formData = new FormData();
    formData.append(
      'file',
      new File(['img'], 'icon.png', { type: 'image/png' })
    );

    // Act
    const result = await uploadFavicon(formData, 'merchant-1');

    // Assert
    expect(result).toEqual({ success: true, result: faviconResult });
    expect(processFavicon).toHaveBeenCalledWith(expect.any(File), 'merchant-1');
    expect(mockEq).toHaveBeenCalledWith('id', 'merchant-1');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('returns unauthorized before processing when auth fails', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const formData = new FormData();
    formData.append(
      'file',
      new File(['img'], 'icon.png', { type: 'image/png' })
    );

    const result = await uploadFavicon(formData, 'merchant-1');

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(processFavicon).not.toHaveBeenCalled();
  });

  it('returns access denied before processing when merchant access fails', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.append(
      'file',
      new File(['img'], 'icon.png', { type: 'image/png' })
    );

    const result = await uploadFavicon(formData, 'merchant-1');

    expect(result).toEqual({
      success: false,
      error: 'Merchant not found or access denied',
    });
    expect(processFavicon).not.toHaveBeenCalled();
  });

  it('does not process a favicon for a different merchant than the selected target', async () => {
    mockGetMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: 'merchant-2',
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
    const formData = new FormData();
    formData.append(
      'file',
      new File(['img'], 'icon.png', { type: 'image/png' })
    );

    const result = await uploadFavicon(formData, 'merchant-1');

    expect(result).toEqual({
      success: false,
      error: 'Merchant not found or access denied',
    });
    expect(processFavicon).not.toHaveBeenCalled();
  });

  it('returns error when processFavicon throws', async () => {
    // Arrange
    vi.mocked(processFavicon).mockRejectedValue(new Error('Sharp failed'));

    const formData = new FormData();
    formData.append(
      'file',
      new File(['img'], 'icon.png', { type: 'image/png' })
    );

    // Act
    const result = await uploadFavicon(formData, 'merchant-1');

    // Assert
    expect(result).toEqual({ success: false, error: 'Sharp failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
