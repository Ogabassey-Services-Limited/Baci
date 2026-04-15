import { describe, expect, it } from 'vitest';
import { buildPreviewUrl } from './build-preview-url';

describe('buildPreviewUrl', () => {
  it('adds https and preview params when the store URL has no scheme', () => {
    expect(buildPreviewUrl('store.usebaci.com', 7)).toBe(
      'https://store.usebaci.com/?preview=true&t=7'
    );
  });

  it('normalizes http URLs to https', () => {
    expect(buildPreviewUrl('http://store.usebaci.com', 3)).toBe(
      'https://store.usebaci.com/?preview=true&t=3'
    );
  });

  it('preserves existing query params when appending preview params', () => {
    expect(buildPreviewUrl('https://store.usebaci.com?foo=bar', 11)).toBe(
      'https://store.usebaci.com/?foo=bar&preview=true&t=11'
    );
  });

  it('returns an empty string for unsupported or invalid URLs', () => {
    expect(buildPreviewUrl('javascript:alert(1)', 1)).toBe('');
    expect(buildPreviewUrl('://bad-url', 1)).toBe('');
  });
});
