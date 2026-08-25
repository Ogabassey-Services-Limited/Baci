import { describe, expect, it } from 'vitest';
import { isStablePublicMediaUrl } from './is-stable-public-media-url';

describe('isStablePublicMediaUrl', () => {
  it('accepts stable HTTPS and root-relative media sources', () => {
    expect(isStablePublicMediaUrl('https://cdn.example.com/logo.png')).toBe(
      true
    );
    expect(isStablePublicMediaUrl('/media/logo.png')).toBe(true);
  });

  it('rejects credentials, query parameters, fragments, and non-HTTPS URLs', () => {
    for (const value of [
      'https://cdn.example.com/logo.png?token=secret',
      'https://cdn.example.com/logo.png#version',
      'https://user:secret@cdn.example.com/logo.png',
      'http://cdn.example.com/logo.png',
    ])
      expect(isStablePublicMediaUrl(value)).toBe(false);
  });
});
