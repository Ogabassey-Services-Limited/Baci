import { describe, expect, it } from 'vitest';
import { DEFAULT_RECEIPT_COLOR, normalizeReceiptColor } from './receipt-colors';

describe('normalizeReceiptColor', () => {
  it('returns safe hex colors unchanged', () => {
    expect(normalizeReceiptColor('#111827')).toBe('#111827');
  });

  it('expands short hex colors for rgba conversion', () => {
    expect(normalizeReceiptColor('#abc')).toBe('#aabbcc');
  });

  it('falls back when the color is unsafe', () => {
    expect(
      normalizeReceiptColor('#111827;}</style><script>alert(1)</script>')
    ).toBe(DEFAULT_RECEIPT_COLOR);
  });

  it('uses the provided fallback for invalid colors', () => {
    expect(normalizeReceiptColor('not-a-color', '#0f172a')).toBe('#0f172a');
  });

  it('normalizes the fallback before returning it', () => {
    expect(normalizeReceiptColor('not-a-color', '#abc')).toBe('#aabbcc');
    expect(normalizeReceiptColor('not-a-color', 'bad-fallback')).toBe(
      DEFAULT_RECEIPT_COLOR
    );
  });
});
