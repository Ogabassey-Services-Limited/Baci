/**
 * Normalizes a social media input (username or URL) into a valid URL.
 * Handles removing leading @ and prepending the correct domain.
 */
export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'youtube',
  'linkedin',
  'pinterest',
  'snapchat',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export function isSocialPlatform(platform: string): platform is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(platform);
}

export function normalizeSocialUrl(
  input: string | undefined,
  platform: SocialPlatform
): string | undefined {
  if (!input?.trim()) return undefined;

  const cleanInput = input.trim();

  // If it's already a URL, return it
  if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
    if (platform === 'twitter') {
      return cleanInput.replace(
        /^https?:\/\/(?:www\.)?x\.com(?=[/?#]|$)/i,
        'https://twitter.com'
      );
    }
    return cleanInput;
  }

  // Remove leading @ if present
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
