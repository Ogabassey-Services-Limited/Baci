import { describe, expect, it } from 'vitest';
import { hasVerifiedCleanupWriteTokenRevocation } from './measure-cloudflare-evidence-sources-requirements';

const tokenId = 'replacement-write';
const validReceipt = {
  tokenId,
  status: 'revoked' as const,
  providerReceiptSha256: 'a'.repeat(64),
  observedAt: '2026-07-31T00:00:00.000Z',
};

describe('hasVerifiedCleanupWriteTokenRevocation', () => {
  it('allows runs without a cleanup replacement token', () => {
    expect(
      hasVerifiedCleanupWriteTokenRevocation({
        cleanupWriteTokenId: undefined,
        cleanupWriteTokenRevocationReceipt: undefined,
      })
    ).toBe(true);
  });

  it('requires a matching structurally verified receipt when a replacement token is present', () => {
    expect(
      hasVerifiedCleanupWriteTokenRevocation({
        cleanupWriteTokenId: tokenId,
        cleanupWriteTokenRevocationReceipt: validReceipt,
      })
    ).toBe(true);
    expect(
      hasVerifiedCleanupWriteTokenRevocation({
        cleanupWriteTokenId: tokenId,
        cleanupWriteTokenRevocationReceipt: undefined,
      })
    ).toBe(false);
    expect(
      hasVerifiedCleanupWriteTokenRevocation({
        cleanupWriteTokenId: tokenId,
        cleanupWriteTokenRevocationReceipt: {
          ...validReceipt,
          tokenId: 'wrong-token',
        },
      })
    ).toBe(false);
    expect(
      hasVerifiedCleanupWriteTokenRevocation({
        cleanupWriteTokenId: tokenId,
        cleanupWriteTokenRevocationReceipt: {
          ...validReceipt,
          providerReceiptSha256: 'not-a-hash',
        },
      })
    ).toBe(false);
  });
});
