import { describe, expect, it } from 'vitest';
import { isValidPreviewUrl } from '@/components/customize/is-valid-preview-url';

describe('isValidPreviewUrl', () => {
  it('accepts https preview URLs', () => {
    expect(isValidPreviewUrl('https://store.usebaci.com?preview=true')).toBe(
      true
    );
  });

  it('rejects empty and unsafe URLs', () => {
    expect(isValidPreviewUrl('')).toBe(false);
    expect(isValidPreviewUrl('javascript:alert(1)')).toBe(false);
    expect(isValidPreviewUrl('http://store.usebaci.com')).toBe(false);
  });
});
