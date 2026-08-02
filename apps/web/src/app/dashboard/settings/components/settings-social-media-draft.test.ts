import { describe, expect, it } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import { buildSocialMediaDraft } from './settings-social-media-draft';

describe('buildSocialMediaDraft', () => {
  it('returns every editable social channel while defaulting absent values to empty strings', () => {
    const merchant = {
      social_media: { twitter: '@baci', instagram: 'baci' },
    } as CachedMerchant;

    expect(buildSocialMediaDraft(merchant)).toEqual({
      twitter: '@baci',
      facebook: '',
      instagram: 'baci',
      tiktok: '',
      youtube: '',
      pinterest: '',
      linkedin: '',
      snapchat: '',
    });
  });
});
