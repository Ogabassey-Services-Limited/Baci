// YouTube video IDs are exactly 11 characters: alphanumeric, hyphens, underscores
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const ALLOWED_VIDEO_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'www.vimeo.com',
];

/**
 * Validates a video URL and converts it to a safe embed URL.
 * Returns `null` for invalid, non-HTTPS, or unrecognized hosts.
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
      parsed.protocol !== 'https:' ||
      !ALLOWED_VIDEO_HOSTS.includes(parsed.hostname)
    ) {
      return null;
    }

    // YouTube watch page → privacy-enhanced embed
    if (
      (parsed.hostname === 'www.youtube.com' ||
        parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch'
    ) {
      const videoId = parsed.searchParams.get('v');
      return videoId && YOUTUBE_ID_PATTERN.test(videoId)
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;
    }

    // youtu.be short link
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1);
      return videoId && YOUTUBE_ID_PATTERN.test(videoId)
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;
    }

    // Vimeo share URL (vimeo.com/123456 or www.vimeo.com/123456) → player embed
    if (
      parsed.hostname === 'vimeo.com' ||
      parsed.hostname === 'www.vimeo.com'
    ) {
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
