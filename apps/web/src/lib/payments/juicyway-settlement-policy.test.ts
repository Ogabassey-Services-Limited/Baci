import { describe, expect, it } from 'vitest';
import { JUICYWAY_UNDERPAYMENT_TOLERANCE } from '@/lib/payments/juicyway-settlement-policy';

describe('JUICYWAY_UNDERPAYMENT_TOLERANCE', () => {
  it('matches the signed webhook underpayment policy', () => {
    expect(JUICYWAY_UNDERPAYMENT_TOLERANCE).toBe(0.01);
  });
});
