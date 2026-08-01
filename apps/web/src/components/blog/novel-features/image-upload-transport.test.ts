import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.fn();
const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: (payload: unknown) => mockToast(payload),
}));
vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

const { createMerchantImageUpload } = await import('./image-upload-transport');

describe('createMerchantImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads inline media with the selected merchant boundary', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      json: async () => ({ url: 'https://cdn.example.com/image.png' }),
      status: 200,
    });
    const file = new File(['image'], 'image.png', { type: 'image/png' });

    await expect(
      createMerchantImageUpload('merchant-selected')(file)
    ).resolves.toBe('https://cdn.example.com/image.png');
    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/merchant/blog/upload',
      expect.objectContaining({
        headers: { 'x-baci-merchant-id': 'merchant-selected' },
        method: 'POST',
      })
    );
    const options = mockFetchWithCsrf.mock.calls[0]?.[1] as { body: FormData };
    expect(options.body.get('file')).toBe(file);
    expect(options.body.get('purpose')).toBe('inline');
  });

  it('rejects unauthorized uploads and surfaces the error', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      json: async () => ({}),
      status: 401,
    });
    const file = new File(['image'], 'image.png', { type: 'image/png' });

    await expect(
      createMerchantImageUpload('merchant-selected')(file)
    ).rejects.toThrow('Image upload unauthorized');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error uploading image',
        variant: 'destructive',
      })
    );
  });
});
