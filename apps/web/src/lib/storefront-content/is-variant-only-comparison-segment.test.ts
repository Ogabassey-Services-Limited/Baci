import { describe, expect, it } from 'vitest';
import { isVariantOnlyComparisonSegment } from './is-variant-only-comparison-segment';

describe('isVariantOnlyComparisonSegment', () => {
  it('accepts shorthand capacity segments', () => {
    const result = isVariantOnlyComparisonSegment(['256', 'gb', 'comparison']);

    expect(result).toBe(true);
  });

  it('rejects a different product segment that also contains capacity', () => {
    const result = isVariantOnlyComparisonSegment([
      'samsung',
      'galaxy',
      's25',
      '256gb',
    ]);

    expect(result).toBe(false);
  });
});
