import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetchWithCsrf = vi.fn();
const mockToast = vi.fn();
const mockCreateImageUpload = vi.fn(
  (config: Record<string, unknown>) => config
);

vi.mock('novel', () => ({
  createImageUpload: (config: Record<string, unknown>) =>
    mockCreateImageUpload(config),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (payload: unknown) => mockToast(payload),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: (...args: unknown[]) => mockFetchWithCsrf(...args),
}));

const { onUpload, uploadFn, validateFn } = await import('./image-upload');

function getUploadBodyFromFirstCall(): FormData {
  if (mockFetchWithCsrf.mock.calls.length === 0) {
    throw new Error('Expected fetchWithCsrf to be called before reading body.');
  }
  const options = mockFetchWithCsrf.mock.calls[0]?.[1] as { body: FormData };
  return options.body;
}

describe('novel image upload integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts inline image uploads with purpose=inline', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      status: 200,
      json: async () => ({
        url: 'https://cdn.example.com/storage/v1/object/public/media/image.png',
      }),
    });

    const file = new File(['image-bytes'], 'inline.png', { type: 'image/png' });
    const result = await onUpload(file);

    expect(result).toBe(
      'https://cdn.example.com/storage/v1/object/public/media/image.png'
    );
    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/merchant/blog/upload',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const body = getUploadBodyFromFirstCall();
    expect(body.get('purpose')).toBe('inline');
    expect(body.get('file')).toBe(file);
  });

  it('rejects when upload responds with 401', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      status: 401,
      json: async () => ({}),
    });

    const file = new File(['image-bytes'], 'inline.png', { type: 'image/png' });
    await expect(onUpload(file)).rejects.toThrow('Image upload unauthorized');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error uploading image',
        variant: 'destructive',
      })
    );
  });

  it('rejects and shows toast when upload fails', async () => {
    mockFetchWithCsrf.mockResolvedValue({
      status: 500,
      json: async () => ({ error: 'Upload failed' }),
    });

    const file = new File(['image-bytes'], 'inline.png', { type: 'image/png' });
    await expect(onUpload(file)).rejects.toThrow('Upload failed');

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error uploading image',
        variant: 'destructive',
      })
    );
  });

  it('keeps validator behavior for type and max-size checks', () => {
    expect(uploadFn).toMatchObject({ onUpload, validateFn });

    expect(validateFn({ type: 'text/plain', size: 10 } as File)).toBe(false);
    expect(
      validateFn({ type: 'application/image/png', size: 10 } as File)
    ).toBe(false);
    expect(
      validateFn({ type: 'image/png', size: 21 * 1024 * 1024 } as File)
    ).toBe(false);
    expect(validateFn({ type: 'image/png', size: 1_024 } as File)).toBe(true);
  });
});
