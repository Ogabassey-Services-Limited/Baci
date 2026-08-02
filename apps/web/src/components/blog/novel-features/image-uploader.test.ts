import { describe, expect, it, vi } from 'vitest';

const mockCreateImageUpload = vi.fn();

vi.mock('novel', () => ({
  createImageUpload: mockCreateImageUpload,
}));

const { createImageUploader } = await import('./image-uploader');
const { validateImageUpload } = await import('./image-upload-validation');

describe('createImageUploader', () => {
  it('wraps the supplied raw transport with Novel image insertion and shared validation', () => {
    const rawUpload = vi.fn();
    const wrappedUploader = vi.fn();
    mockCreateImageUpload.mockReturnValue(wrappedUploader);

    expect(createImageUploader(rawUpload)).toBe(wrappedUploader);
    expect(mockCreateImageUpload).toHaveBeenCalledWith({
      onUpload: rawUpload,
      validateFn: validateImageUpload,
    });
  });
});
