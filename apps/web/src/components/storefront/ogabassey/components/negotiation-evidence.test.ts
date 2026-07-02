// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadNegotiationEvidenceFile } from './negotiation-evidence';

const mockFetch = vi.fn();
const mockUploadToSignedUrl = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        uploadToSignedUrl: mockUploadToSignedUrl,
      }),
    },
  }),
}));

describe('uploadNegotiationEvidenceFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    mockUploadToSignedUrl.mockReset();
    mockFetch.mockResolvedValue({
      json: async () => ({
        evidencePath: 'merchant-123/server-uploaded-proof.png',
        uploadToken: 'upload-token',
      }),
      ok: true,
    });
    mockUploadToSignedUrl.mockResolvedValue({
      data: { path: 'stored' },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes and uploads an accepted proof image with a signed upload token', async () => {
    const file = new File(['proof'], 'Promo Screenshot.PNG', {
      type: 'image/png',
    });

    const evidencePath = await uploadNegotiationEvidenceFile({
      file,
      merchantId: 'merchant-123',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/storefront/negotiation-evidence',
      expect.objectContaining({
        body: JSON.stringify({
          contentType: 'image/png',
          fileName: 'Promo Screenshot.PNG',
          fileSize: file.size,
          merchantId: 'merchant-123',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    );
    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(
      'merchant-123/server-uploaded-proof.png',
      'upload-token',
      file,
      { contentType: 'image/png', upsert: false }
    );
    expect(evidencePath).toBe('merchant-123/server-uploaded-proof.png');
  });

  it('rejects unsupported files before uploading', async () => {
    const file = new File(['proof'], 'quote.pdf', {
      type: 'application/pdf',
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file,
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Upload a screenshot or photo.');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a disallowed MIME type even when the filename extension is allowed', async () => {
    const file = new File(['proof'], 'screenshot.png', {
      type: 'text/plain',
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file,
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Upload a screenshot or photo.');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects proof images over 10 MB before uploading', async () => {
    const oversizedFile = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      'large-proof.png',
      { type: 'image/png' }
    );

    await expect(
      uploadNegotiationEvidenceFile({
        file: oversizedFile,
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Upload a proof image under 10 MB.');

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses filename extension fallback only when the browser omits the MIME type', async () => {
    const file = new File(['proof'], 'iphone-proof.HEIC', {
      type: '',
    });

    const evidencePath = await uploadNegotiationEvidenceFile({
      file,
      merchantId: 'merchant-123',
    });

    expect(evidencePath).toBe('merchant-123/server-uploaded-proof.png');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('uses filename extension fallback for octet-stream images', async () => {
    const file = new File(['proof'], 'iphone-proof.HEIC', {
      type: 'application/octet-stream',
    });

    await uploadNegotiationEvidenceFile({
      file,
      merchantId: 'merchant-123',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/storefront/negotiation-evidence',
      expect.objectContaining({
        body: JSON.stringify({
          contentType: 'image/heic',
          fileName: 'iphone-proof.HEIC',
          fileSize: file.size,
          merchantId: 'merchant-123',
        }),
      })
    );
    expect(mockUploadToSignedUrl).toHaveBeenCalledWith(
      'merchant-123/server-uploaded-proof.png',
      'upload-token',
      file,
      { contentType: 'image/heic', upsert: false }
    );
  });

  it('surfaces API upload failures', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error: 'Upload init denied' }),
      ok: false,
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Upload init denied');
    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
  });

  it('uses the default failure message when the API returns no message', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({}),
      ok: false,
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Failed to upload evidence image.');
    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
  });

  it('uses the default failure message when the API response omits the path', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({}),
      ok: true,
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Failed to upload evidence image.');
    expect(mockUploadToSignedUrl).not.toHaveBeenCalled();
  });

  it('surfaces signed upload failures', async () => {
    mockUploadToSignedUrl.mockResolvedValueOnce({
      data: null,
      error: { message: 'Signed upload failed' },
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Signed upload failed');
  });
});
