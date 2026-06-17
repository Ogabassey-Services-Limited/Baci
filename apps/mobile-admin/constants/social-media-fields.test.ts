import { describe, expect, it } from 'vitest';
import {
  EMPTY_SOCIAL_MEDIA,
  SOCIAL_MEDIA_FIELDS,
} from './social-media-fields';

describe('social media field constants', () => {
  it('provides an empty default for every configured field platform', () => {
    for (const { platform } of SOCIAL_MEDIA_FIELDS) {
      expect(EMPTY_SOCIAL_MEDIA[platform]).toBe('');
    }
  });

  it('keeps field platforms and empty defaults in sync', () => {
    const fieldPlatforms = SOCIAL_MEDIA_FIELDS.map(({ platform }) => platform);
    const defaultPlatforms = Object.keys(EMPTY_SOCIAL_MEDIA).sort();
    const uniqueFieldPlatforms = new Set(fieldPlatforms);

    expect(uniqueFieldPlatforms.size).toBe(fieldPlatforms.length);
    expect(fieldPlatforms.sort()).toEqual(defaultPlatforms);
  });

  it('uses empty strings for every default value', () => {
    expect(Object.values(EMPTY_SOCIAL_MEDIA)).toEqual(
      Array.from({ length: Object.keys(EMPTY_SOCIAL_MEDIA).length }, () => '')
    );
  });
});
