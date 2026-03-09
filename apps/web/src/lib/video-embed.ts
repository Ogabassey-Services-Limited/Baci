const ALLOWED_VIDEO_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
];

/**
 * Validates a video URL and converts it to a safe embed URL.
 * Returns `null` for invalid, non-HTTPS, or unrecognised hosts.
 *
 * Supported conversions:
 * - YouTube watch URLs → youtube-nocookie.com/embed/{id}
 * - youtu.be short URLs → youtube-nocookie.com/embed/{id}
 * - Vimeo share URLs (vimeo.com/{id}) → player.vimeo.com/video/{id}
 * - Already-embeddable URLs (player.vimeo.com, youtube-nocookie.com/embed) pass through.
 */
export function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !ALLOWED_VIDEO_HOSTS.includes(parsed.hostname)
    ) {
      return null;
    }

    // YouTube watch page → privacy-enhanced embed
    if (
      parsed.hostname.includes('youtube.com') &&
      parsed.pathname === '/watch'
    ) {
      const videoId = parsed.searchParams.get('v');
      return videoId
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;
    }

    // youtu.be short link
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1);
      return videoId
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;
    }

    // Vimeo share URL (vimeo.com/123456) → player embed
    if (parsed.hostname === 'vimeo.com') {
      if (/^\/\d+$/.test(parsed.pathname)) {
        const videoId = parsed.pathname.slice(1);
        return `https://player.vimeo.com/video/${videoId}`;
      }
      // Reject non-numeric vimeo.com paths (channels, users, etc.)
      return null;
    }

    // Already an embed-ready URL (player.vimeo.com, youtube-nocookie.com/embed, etc.)
    return url;
  } catch {
    return null;
  }
}
