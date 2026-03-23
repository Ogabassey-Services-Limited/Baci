import { describe, expect, it } from 'vitest';
import { formatVariantAttributesLabel } from '@/lib/format-variant-attributes-label';

describe('formatVariantAttributesLabel', () => {
  it('returns undefined for nullish or unsupported values', () => {
    expect(formatVariantAttributesLabel(null)).toBeUndefined();
    expect(formatVariantAttributesLabel(undefined)).toBeUndefined();
    expect(formatVariantAttributesLabel('Blue')).toBeUndefined();
    expect(formatVariantAttributesLabel(['Blue', '128GB'])).toBeUndefined();
  });

  it('returns a deterministic label from trimmed string values', () => {
    expect(
      formatVariantAttributesLabel({
        storage: ' 128GB ',
        color: 'Blue',
      })
    ).toBe('Blue / 128GB');
  });

  it('ignores empty or non-string values', () => {
    expect(
      formatVariantAttributesLabel({
        color: 'Black',
        stock: 3,
        note: '   ',
      })
    ).toBe('Black');
  });
});
