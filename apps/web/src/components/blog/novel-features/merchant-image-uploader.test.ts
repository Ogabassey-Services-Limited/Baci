import { describe, expect, it, vi } from 'vitest';

const { mockCreateImageUploader, mockCreateMerchantImageUpload } = vi.hoisted(
  () => ({
    mockCreateImageUploader: vi.fn(),
    mockCreateMerchantImageUpload: vi.fn(),
  })
);

vi.mock('./image-uploader', () => ({
  createImageUploader: mockCreateImageUploader,
}));

vi.mock('./image-upload-transport', () => ({
  createMerchantImageUpload: mockCreateMerchantImageUpload,
}));

const { createMerchantImageUploader } = await import(
  './merchant-image-uploader'
);

describe('createMerchantImageUploader', () => {
  it('creates a merchant-scoped transport before passing it to the generic editor uploader', () => {
    const merchantTransport = vi.fn();
    const wrappedUploader = vi.fn();
    mockCreateMerchantImageUpload.mockReturnValue(merchantTransport);
    mockCreateImageUploader.mockReturnValue(wrappedUploader);

    expect(createMerchantImageUploader('merchant-selected')).toBe(
      wrappedUploader
    );
    expect(mockCreateMerchantImageUpload).toHaveBeenCalledWith(
      'merchant-selected'
    );
    expect(mockCreateImageUploader).toHaveBeenCalledWith(merchantTransport);
  });
});
