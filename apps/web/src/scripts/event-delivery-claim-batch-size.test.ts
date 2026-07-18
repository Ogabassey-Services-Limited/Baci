import { describe, expect, it } from 'vitest';
import { getEventDeliveryClaimBatchSize } from './event-delivery-claim-batch-size';

describe('getEventDeliveryClaimBatchSize', () => {
  it('keeps claimed work within two bounded concurrency waves', () => {
    expect(getEventDeliveryClaimBatchSize(1)).toBe(2);
    expect(getEventDeliveryClaimBatchSize(5)).toBe(10);
    expect(getEventDeliveryClaimBatchSize(100)).toBe(25);
  });

  it('keeps non-positive concurrency to one claim wave', () => {
    expect(getEventDeliveryClaimBatchSize(0)).toBe(2);
    expect(getEventDeliveryClaimBatchSize(-5)).toBe(2);
  });
});
