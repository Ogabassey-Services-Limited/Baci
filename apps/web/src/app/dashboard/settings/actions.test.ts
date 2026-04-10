import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
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
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/settings');
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
