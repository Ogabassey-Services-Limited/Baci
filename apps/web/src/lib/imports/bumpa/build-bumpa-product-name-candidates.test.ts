import { describe, expect, it } from 'vitest';
import { buildBumpaProductNameCandidates } from './build-bumpa-product-name-candidates';

describe('buildBumpaProductNameCandidates', () => {
  it('returns raw, stripped, and brand-normalized candidates', () => {
    expect(
      buildBumpaProductNameCandidates(
        'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261'
      )
    ).toEqual([
      'Pixel 7a 128gb (Premium Used) IMEI: 351183326811261',
      'Pixel 7a 128GB (Premium Used)',
      'Google Pixel 7a 128GB (Premium Used)',
    ]);
  });

  it('drops empty parenthesized identifier groups', () => {
    expect(
      buildBumpaProductNameCandidates('iPhone 12 128gb (IMEI: 351183326811261)')
    ).toEqual(['iPhone 12 128gb (IMEI: 351183326811261)', 'iPhone 12 128GB']);
  });
});
