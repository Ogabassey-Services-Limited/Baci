import { describe, expect, it } from 'vitest';
import {
  buildPublicFaviconUrl,
  FAVICON_STORAGE_BUCKET,
  getFaviconStoragePaths,
} from '@/lib/favicon-storage-paths';

const MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

describe('favicon storage paths', () => {
  it('matches the favicon upload pipeline object names', () => {
    expect(getFaviconStoragePaths(MERCHANT_ID)).toEqual({
      appleTouchPath: `${MERCHANT_ID}/apple-touch-icon.png`,
      png192Path: `${MERCHANT_ID}/icon-192.png`,
      png32Path: `${MERCHANT_ID}/icon-32.png`,
      svgPath: `${MERCHANT_ID}/icon.svg`,
    });
  });

  it('builds public URLs from the favicons bucket', () => {
    expect(
      buildPublicFaviconUrl(
        'https://example.supabase.co/',
        `${MERCHANT_ID}/icon-32.png`
      )
    ).toBe(
      `https://example.supabase.co/storage/v1/object/public/${FAVICON_STORAGE_BUCKET}/${MERCHANT_ID}/icon-32.png`
    );
  });
});
