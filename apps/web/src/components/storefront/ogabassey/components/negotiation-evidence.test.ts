// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  uploadNegotiationEvidenceFile,
} from './negotiation-evidence';

const mockFetch = vi.fn();

describe('uploadNegotiationEvidenceFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      json: async () => ({
        evidencePath: 'merchant-123/server-uploaded-proof.png',
      }),
      ok: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts an accepted proof image to the evidence upload API', async () => {
    const file = new File(['proof'], 'Promo Screenshot.PNG', {
      type: 'image/png',
    });

    const evidencePath = await uploadNegotiationEvidenceFile({
      file,
      merchantId: 'merchant-123',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/storefront/negotiation-evidence',
      expect.objectContaining({ method: 'POST' })
    );
    const body = mockFetch.mock.calls[0][1]?.body as FormData;
    expect(body.get('merchantId')).toBe('merchant-123');
    expect(body.get('file')).toBe(file);
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

  it('surfaces API upload failures', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error: 'Upload denied' }),
      ok: false,
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
      })
    ).rejects.toThrow('Upload denied');
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
  });
});
