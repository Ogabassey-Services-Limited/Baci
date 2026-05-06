import {
  buildPublicFaviconUrl,
  getFaviconStoragePaths,
} from '@/lib/favicon-storage-paths';

export const OGABASSEY_URL = 'https://ogabassey.com';
export const OGABASSEY_TITLE = 'OgaBassey - Official Online Store';
export const OGABASSEY_DESCRIPTION =
  'Shop OgaBassey for phones, laptops, gaming consoles, accessories, subscriptions, airtime, data, and flexible payment options in Nigeria.';
export const OGABASSEY_SOCIAL_IMAGE_URL = `${OGABASSEY_URL}/template-previews/ogabassey-v2.png`;
export const OGABASSEY_TWITTER_HANDLE = '@ogabasseyy';

const SUPABASE_PUBLIC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  'https://aivqthbxdshhltbwipbr.supabase.co';

// OgaBassey merchants.id backing favicons/{id}/... storage paths.
export const OGABASSEY_MERCHANT_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';
const OGABASSEY_FAVICON_PATHS = getFaviconStoragePaths(OGABASSEY_MERCHANT_ID);

export const OGABASSEY_FAVICON_URL = buildPublicFaviconUrl(
  SUPABASE_PUBLIC_URL,
  OGABASSEY_FAVICON_PATHS.png32Path
);
export const OGABASSEY_APPLE_TOUCH_ICON_URL = buildPublicFaviconUrl(
  SUPABASE_PUBLIC_URL,
  OGABASSEY_FAVICON_PATHS.appleTouchPath
);
