/**
 * Social Media Link Normalization Utility
 * Matches web implementation for consistency
 */

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'youtube'
  | 'linkedin'
  | 'snapchat';

export function normalizeSocialUrl(
  input: string | undefined,
  platform: SocialPlatform
): string | undefined {
  if (!input || !input.trim()) return undefined;

  const cleanInput = input.trim();

  // If it's already a URL, return it
  if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
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
      // Rebranded to X.com
      return `https://x.com/${handle}`;
    case 'youtube':
      // YouTube handles usually start with @
      return `https://youtube.com/@${handle}`;
    case 'linkedin':
      // Default to company for merchants
      return `https://linkedin.com/company/${handle}`;
    case 'snapchat':
      return `https://www.snapchat.com/@${handle}`;
    default:
      return `https://${platform}.com/${handle}`;
  }
}
