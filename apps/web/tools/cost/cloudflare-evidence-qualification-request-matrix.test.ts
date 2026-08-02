import { describe, expect, it } from 'vitest';
import { QualificationZeroWeightRequestMatrixSchema } from './cloudflare-evidence-qualification-authority';

const matrix = {
  ordinaryRequestSha256: 'a'.repeat(64),
  ordinaryResponseSha256: 'b'.repeat(64),
  ordinaryRequestCount: 4,
  protectedOverrideRequestSha256: 'c'.repeat(64),
  protectedOverrideResponseSha256: 'd'.repeat(64),
  protectedOverrideRequestCount: 1,
};

describe('QualificationZeroWeightRequestMatrixSchema', () => {
  it('accepts the exact six-field reviewed matrix', () => {
    expect(
      QualificationZeroWeightRequestMatrixSchema.safeParse(matrix).success
    ).toBe(true);
  });

  it.each([0, -1, 1.5])('rejects an invalid request count of %s', (count) => {
    expect(
      QualificationZeroWeightRequestMatrixSchema.safeParse({
        ...matrix,
        ordinaryRequestCount: count,
      }).success
    ).toBe(false);
  });

  it('rejects missing and unknown fields', () => {
    const { ordinaryRequestSha256: _missing, ...incomplete } = matrix;
    expect(
      QualificationZeroWeightRequestMatrixSchema.safeParse(incomplete).success
    ).toBe(false);
    expect(
      QualificationZeroWeightRequestMatrixSchema.safeParse({
        ...matrix,
        unreviewed: true,
      }).success
    ).toBe(false);
  });
});
