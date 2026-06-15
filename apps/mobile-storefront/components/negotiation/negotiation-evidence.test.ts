import { describe, expect, it, jest } from '@jest/globals';
import {
  extractNegotiationFileExtension,
  isRemoteEvidenceUrl,
  uploadNegotiationEvidence,
} from './negotiation-evidence';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

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
  it('returns remote URLs unchanged without uploading', async () => {
    await expect(
      uploadNegotiationEvidence('https://example.com/proof.png', null)
    ).resolves.toBe('https://example.com/proof.png');
  });

  it('throws when a local file is provided without a merchant id', async () => {
    await expect(
      uploadNegotiationEvidence('file:///tmp/proof.png', null)
    ).rejects.toThrow('Missing merchant id');
  });
});
