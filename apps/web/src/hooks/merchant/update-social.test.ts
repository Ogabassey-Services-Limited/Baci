import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSocial } from './update-social';

const mockApiPatch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiPatch: (url: string, data?: unknown) => mockApiPatch(url, data),
}));

describe('updateSocial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes the dedicated /api/merchant/settings route with social_media', async () => {
    // Arrange
    mockApiPatch.mockResolvedValueOnce({
      merchant: { id: 'm1', social_media: { twitter: '@oga' } },
    });

    // Act
    const result = await updateSocial('11111111-1111-4111-8111-111111111111', {
      twitter: '@oga',
    });

    // Assert
    expect(mockApiPatch).toHaveBeenCalledWith('/api/merchant/settings', {
      merchantId: '11111111-1111-4111-8111-111111111111',
      social_media: { twitter: '@oga' },
    });
    expect(result.merchant.social_media).toEqual({ twitter: '@oga' });
  });

  it('propagates errors from the PATCH route', async () => {
    // Arrange
    mockApiPatch.mockRejectedValueOnce(new Error('Forbidden'));

    // Act & Assert
    await expect(
      updateSocial('11111111-1111-4111-8111-111111111111', {
        twitter: '@oga',
      })
    ).rejects.toThrow('Forbidden');
  });
});
