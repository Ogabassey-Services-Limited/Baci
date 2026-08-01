import { describe, expect, it } from 'vitest';
import { assertMeasurementObservationWindow } from './measurement-observation-window';

const journal = {
  writeTokenRevocationReceipt: {
    tokenId: 'write',
    status: 'revoked' as const,
    providerReceiptSha256: 'a'.repeat(64),
    observedAt: '2026-07-31T00:00:00.000Z',
  },
  cleanupVerifiedAt: '2026-07-31T00:00:00.000Z',
};
const now = new Date('2026-07-31T00:05:00.000Z');

describe('assertMeasurementObservationWindow', () => {
  it('accepts an observation inside the revocation and lag bounds', () => {
    expect(() =>
      assertMeasurementObservationWindow(
        journal,
        '2026-07-31T00:04:00.000Z',
        now
      )
    ).not.toThrow();
  });

  it.each([
    '2026-07-30T23:59:59.999Z',
    '2026-07-31T00:06:00.000Z',
    '2026-07-29T00:00:00.000Z',
  ])('rejects observation %s outside the active run window', (observedAt) => {
    expect(() =>
      assertMeasurementObservationWindow(journal, observedAt, now)
    ).toThrow('outside the active run window');
  });
});
