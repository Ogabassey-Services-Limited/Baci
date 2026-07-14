import { filterBrandMatchedSocialProfiles } from './brand-matched-social-profiles';
import { isValidTwitterProfileHandle } from './twitter-profile-handle';

function extractTwitterHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      if (
        ![
          'mobile.twitter.com',
          'mobile.x.com',
          'twitter.com',
          'www.twitter.com',
          'www.x.com',
          'x.com',
        ].includes(host)
      ) {
        return null;
      }
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const segment =
        pathSegments.length === 1 ? (pathSegments[0] ?? null) : null;
      return segment?.startsWith('@') ? segment.slice(1) : segment;
    } catch {
      return null;
    }
  }

  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

export function getBrandMatchedTwitterHandle(
  businessName: string,
  value: string | null | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  const handle = extractTwitterHandle(value);
  if (!handle || !isValidTwitterProfileHandle(handle)) {
    return undefined;
  }

  const profileUrl = `https://x.com/${handle}`;
  return filterBrandMatchedSocialProfiles(businessName, [profileUrl]).length > 0
    ? `@${handle}`
    : undefined;
}
