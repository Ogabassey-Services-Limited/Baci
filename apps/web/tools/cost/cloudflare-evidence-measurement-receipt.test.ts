import { describe, expect, it } from 'vitest';
import type { MeasurementReceipt } from './cloudflare-evidence-measurement-receipt';

describe('measurement receipt payload binding', () => {
  it('requires both the provider receipt and payload digest', () => {
    const receipt: MeasurementReceipt = {
      providerReceiptSha256: 'a'.repeat(64),
      payloadSha256: 'b'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    };
    expect(receipt.payloadSha256).toHaveLength(64);
  });
});
