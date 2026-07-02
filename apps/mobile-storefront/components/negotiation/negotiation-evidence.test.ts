import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  extractNegotiationFileExtension,
  isRemoteEvidenceUrl,
  MAX_NEGOTIATION_EVIDENCE_BYTES,
  uploadNegotiationEvidence,
} from './negotiation-evidence';

jest.mock('@/env', () => ({
  EXPO_PUBLIC_API_URL: 'https://usebaci.com',
}));

const createBlobLike = ({
  bytes = new Uint8Array([1, 2, 3]),
  size = bytes.byteLength,
  type = 'image/png',
}: {
  bytes?: Uint8Array;
  size?: number;
  type?: string;
} = {}) => ({
  arrayBuffer: jest.fn(async () => bytes.buffer.slice(0)),
  size,
  type,
});

describe('negotiation evidence helpers', () => {
  it('detects remote evidence URLs', () => {
    expect(isRemoteEvidenceUrl('https://example.com/proof.png')).toBe(true);
    expect(isRemoteEvidenceUrl('http://example.com/proof.png')).toBe(true);
    expect(isRemoteEvidenceUrl('file:///tmp/proof.png')).toBe(false);
  });

  it('prefers content-type extension and falls back to URI extension', () => {
    expect(
      extractNegotiationFileExtension('file:///tmp/proof', 'image/png')
    ).toBe('png');
    expect(
      extractNegotiationFileExtension(
        'file:///tmp/proof.jpeg?token=abc',
        'application/octet-stream'
      )
    ).toBe('jpeg');
    expect(
      extractNegotiationFileExtension(
        'file:///tmp/proof',
        'application/octet-stream'
      )
    ).toBe('jpg');
  });
});

describe('uploadNegotiationEvidence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('file://')) {
        return {
          ok: true,
          blob: async () => createBlobLike(),
        };
      }

      return {
        json: async () => ({ evidencePath: 'merchant-1/server-proof.png' }),
        ok: true,
      };
    }) as unknown as typeof fetch;
  });

  it('returns remote URLs unchanged without uploading', async () => {
    await expect(
      uploadNegotiationEvidence('https://example.com/proof.png', null)
    ).resolves.toBe('https://example.com/proof.png');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws when a local file is provided without a merchant id', async () => {
    await expect(
      uploadNegotiationEvidence('file:///tmp/proof.png', null)
    ).rejects.toThrow('Missing merchant id');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads local image evidence through the evidence API and returns the durable storage path', async () => {
    await expect(
      uploadNegotiationEvidence('file:///tmp/proof.png', 'merchant-1')
    ).resolves.toBe('merchant-1/server-proof.png');

    expect(fetch).toHaveBeenNthCalledWith(1, 'file:///tmp/proof.png');
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://usebaci.com/api/storefront/negotiation-evidence',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('infers image content type from the local file extension when blob type is empty', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('file://')) {
        return {
          ok: true,
          blob: async () => createBlobLike({ type: '' }),
        };
      }

      return {
        json: async () => ({ evidencePath: 'merchant-1/server-proof.webp' }),
        ok: true,
      };
    }) as unknown as typeof fetch;

    await uploadNegotiationEvidence('file:///tmp/proof.webp', 'merchant-1');

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://usebaci.com/api/storefront/negotiation-evidence',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws when the local file cannot be read', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      blob: async () => createBlobLike(),
    })) as unknown as typeof fetch;

    await expect(
      uploadNegotiationEvidence('file:///tmp/missing.png', 'merchant-1')
    ).rejects.toThrow('Failed to read evidence file: 404');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects non-image evidence before reading bytes', async () => {
    const blob = createBlobLike({ type: 'application/pdf' });
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      blob: async () => blob,
    })) as unknown as typeof fetch;

    await expect(
      uploadNegotiationEvidence('file:///tmp/proof.pdf', 'merchant-1')
    ).rejects.toThrow('Only image evidence is supported');

    expect(blob.arrayBuffer).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized evidence before reading bytes', async () => {
    const blob = createBlobLike({ size: MAX_NEGOTIATION_EVIDENCE_BYTES + 1 });
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      blob: async () => blob,
    })) as unknown as typeof fetch;

    await expect(
      uploadNegotiationEvidence('file:///tmp/huge.png', 'merchant-1')
    ).rejects.toThrow('Evidence image is too large');

    expect(blob.arrayBuffer).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when evidence API upload fails', async () => {
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('file://')) {
        return {
          ok: true,
          blob: async () => createBlobLike(),
        };
      }

      return {
        json: async () => ({ error: 'upload failed' }),
        ok: false,
      };
    }) as unknown as typeof fetch;
    await expect(
      uploadNegotiationEvidence('file:///tmp/proof.png', 'merchant-1')
    ).rejects.toThrow('upload failed');
  });
});
