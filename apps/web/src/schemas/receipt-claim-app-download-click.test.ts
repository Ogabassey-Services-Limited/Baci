import { describe, expect, it } from 'vitest';
import { receiptClaimAppDownloadClickBodySchema } from '@/schemas/receipt-claim-app-download-click';

describe('receiptClaimAppDownloadClickBodySchema', () => {
  it('accepts known app download targets', () => {
    expect(
      receiptClaimAppDownloadClickBodySchema.safeParse({
        target: 'app_store',
      }).success
    ).toBe(true);
    expect(
      receiptClaimAppDownloadClickBodySchema.safeParse({
        target: 'play_store',
      }).success
    ).toBe(true);
  });

  it('rejects missing and unknown app download targets', () => {
    expect(receiptClaimAppDownloadClickBodySchema.safeParse({}).success).toBe(
      false
    );
    expect(
      receiptClaimAppDownloadClickBodySchema.safeParse({
        target: 'side_load',
      }).success
    ).toBe(false);
  });
});
