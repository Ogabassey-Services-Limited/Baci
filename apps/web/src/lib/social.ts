/**
 * Normalizes a social media input (username or URL) into a valid URL.
 * Handles removing leading @ and prepending the correct domain.
 */
export function normalizeSocialUrl(
  input: string | undefined,
  platform:
    | 'instagram'
    | 'facebook'
    | 'tiktok'
    | 'twitter'
    | 'youtube'
    | 'linkedin'
    | 'snapchat'
): string | undefined {
  if (!input?.trim()) return undefined;

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
      return `https://x.com/${handle}`;
    case 'snapchat':
      return `https://www.snapchat.com/@${handle}`;
    case 'youtube':
      // YouTube handles usually start with @
      return `https://youtube.com/@${handle}`;
    case 'linkedin':
      // Default to company for merchants, but fallback/support personal 'in/' logic is hard without more context.
      // Defaulting to company page as Baci is B2B2C.
      return `https://linkedin.com/company/${handle}`;
    default:
      return `https://${platform}.com/${handle}`;
  }
}
