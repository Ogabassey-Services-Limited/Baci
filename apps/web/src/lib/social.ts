export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'youtube'
  | 'linkedin'
  | 'snapchat'
  | 'pinterest';

const TWITTER_PROFILE_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);
const TWITTER_RESERVED_PATHS = new Set([
  'explore',
  'home',
  'i',
  'intent',
  'messages',
  'notifications',
  'search',
  'settings',
  'share',
]);

function normalizeTwitterProfileUrl(input: string): string | undefined {
  try {
    const url = new URL(input);
    if (!TWITTER_PROFILE_HOSTS.has(url.hostname.toLowerCase())) {
      return undefined;
    }

    const pathSegments = url.pathname.split('/').filter(Boolean);
    if (pathSegments.length !== 1) {
      return undefined;
    }

    const [handle] = pathSegments;
    if (
      !handle ||
      TWITTER_RESERVED_PATHS.has(handle.toLowerCase()) ||
      !/^[A-Za-z0-9_]{1,15}$/.test(handle)
    ) {
      return undefined;
    }

    return `https://twitter.com/${handle}`;
  } catch {
    return undefined;
  }
}

export function normalizeSocialUrl(
  input: string | undefined,
  platform: SocialPlatform
): string | undefined {
  if (!input?.trim()) return undefined;

  const cleanInput = input.trim();

  if (/^https?:\/\//i.test(cleanInput)) {
    if (platform === 'twitter') {
      return normalizeTwitterProfileUrl(cleanInput) ?? cleanInput;
    }

    return cleanInput;
  }

  const handle = cleanInput.replace(/^@/, '');

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'twitter':
      return `https://twitter.com/${handle}`;
    case 'snapchat':
      return `https://www.snapchat.com/@${handle}`;
    case 'youtube':
      // YouTube handles usually start with @
      return `https://youtube.com/@${handle}`;
    case 'linkedin':
      // Default to company for merchants, but fallback/support personal 'in/' logic is hard without more context.
      // Defaulting to company page as Baci is B2B2C.
      return `https://linkedin.com/company/${handle}`;
    case 'pinterest':
      return `https://pinterest.com/${handle}`;
    default:
      return `https://${platform}.com/${handle}`;
  }
}
