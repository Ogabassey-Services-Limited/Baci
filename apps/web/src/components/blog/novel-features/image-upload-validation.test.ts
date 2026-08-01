import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  toast: (payload: unknown) => mockToast(payload),
}));

const { validateImageUpload } = await import('./image-upload-validation');

describe('validateImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts supported images within the size limit', () => {
    expect(
      validateImageUpload({ size: 1_024, type: 'image/png' } as File)
    ).toBe(true);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('rejects non-image files', () => {
    expect(
      validateImageUpload({ size: 1_024, type: 'text/plain' } as File)
    ).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'File type not supported.' })
    );
  });

  it('rejects images larger than 20MB', () => {
    expect(
      validateImageUpload({
        size: 21 * 1024 * 1024,
        type: 'image/png',
      } as File)
    ).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'File size too big (max 20MB).' })
    );
  });
});
