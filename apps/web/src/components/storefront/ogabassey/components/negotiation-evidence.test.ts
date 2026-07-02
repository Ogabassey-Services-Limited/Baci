// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NEGOTIATION_EVIDENCE_BUCKET,
  uploadNegotiationEvidenceFile,
} from './negotiation-evidence';

const mockUpload = vi.fn();
const mockFrom = vi.fn(() => ({ upload: mockUpload }));

const storageClient = {
  storage: {
    from: mockFrom,
  },
};

describe('uploadNegotiationEvidenceFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    mockFrom.mockClear();
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ data: { path: 'stored' }, error: null });
  });

  it('uploads an accepted proof image to the private negotiation evidence bucket', async () => {
    const file = new File(['proof'], 'Promo Screenshot.PNG', {
      type: 'image/png',
    });

    const evidencePath = await uploadNegotiationEvidenceFile({
      file,
      merchantId: 'merchant-123',
      supabase: storageClient,
    });

    expect(mockFrom).toHaveBeenCalledWith(NEGOTIATION_EVIDENCE_BUCKET);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload.mock.calls[0][0]).toBe(
      'merchant-123/1700000000000-4fzyo8-promo-screenshot.png'
    );
    expect(mockUpload.mock.calls[0][2]).toMatchObject({
      contentType: 'image/png',
      upsert: false,
    });
    expect(evidencePath).toBe(
      'merchant-123/1700000000000-4fzyo8-promo-screenshot.png'
    );
  });

  it('rejects unsupported files before uploading', async () => {
    const file = new File(['proof'], 'quote.pdf', {
      type: 'application/pdf',
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file,
        merchantId: 'merchant-123',
        supabase: storageClient,
      })
    ).rejects.toThrow('Upload a screenshot or photo.');

    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects a disallowed MIME type even when the filename extension is allowed', async () => {
    const file = new File(['proof'], 'screenshot.png', {
      type: 'text/plain',
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file,
        merchantId: 'merchant-123',
        supabase: storageClient,
      })
    ).rejects.toThrow('Upload a screenshot or photo.');

    expect(mockUpload).not.toHaveBeenCalled();
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
        supabase: storageClient,
      })
    ).rejects.toThrow('Upload a proof image under 10 MB.');

    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('uses filename extension fallback only when the browser omits the MIME type', async () => {
    const file = new File(['proof'], 'iphone-proof.HEIC', {
      type: '',
    });

    const evidencePath = await uploadNegotiationEvidenceFile({
      file,
      merchantId: 'merchant-123',
      supabase: storageClient,
    });

    expect(evidencePath).toBe(
      'merchant-123/1700000000000-4fzyo8-iphone-proof.heic'
    );
    expect(mockUpload.mock.calls[0][2]).toMatchObject({
      contentType: 'image/heic',
      upsert: false,
    });
  });

  it('surfaces storage upload failures', async () => {
    mockUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'RLS denied upload' },
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
        supabase: storageClient,
      })
    ).rejects.toThrow('RLS denied upload');
  });

  it('uses the default storage failure message when Supabase returns no message', async () => {
    mockUpload.mockResolvedValueOnce({
      data: null,
      error: {},
    });

    await expect(
      uploadNegotiationEvidenceFile({
        file: new File(['proof'], 'screenshot.jpg', { type: 'image/jpeg' }),
        merchantId: 'merchant-123',
        supabase: storageClient,
      })
    ).rejects.toThrow('Failed to upload evidence image.');
  });
});
