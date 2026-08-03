import { describe, expect, it } from 'vitest';
import { SHIPMENT_STATUS_LABELS } from './tracking-types';

describe('shipping tracking types', () => {
  it('keeps labels for every shared shipment lifecycle status', () => {
    expect(SHIPMENT_STATUS_LABELS).toMatchObject({
      delivered: 'Delivered',
      failed: 'Failed',
      in_transit: 'In Transit',
    });
  });
});
