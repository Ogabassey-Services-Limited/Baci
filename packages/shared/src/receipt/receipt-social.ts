import { escapeHtml } from './escape-html';
import type { ReceiptMerchant } from './types';

type SocialPlatform = 'instagram' | 'facebook' | 'twitter' | 'tiktok';

const SOCIAL_HOSTS: Record<SocialPlatform, readonly string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  twitter: ['x.com', 'twitter.com'],
  tiktok: ['tiktok.com'],
};

const IG_RESERVED_PATHS = new Set([
  'accounts',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
]);
const FACEBOOK_RESERVED_PATHS = new Set([
  'events',
  'groups',
  'marketplace',
  'people',
  'profile.php',
  'share',
  'sharer',
  'watch',
]);
const TWITTER_RESERVED_PATHS = new Set(['home', 'i', 'intent', 'share']);
const TIKTOK_RESERVED_PATHS = new Set(['discover', 'foryou', 'tag', 'video']);

const SOCIAL_ICONS: Record<SocialPlatform, string> = {
  instagram:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E4405F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
  twitter:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  tiktok:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="#000000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.12z"/></svg>',
  facebook:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
};

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSocialHost(platform: SocialPlatform, hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  return SOCIAL_HOSTS[platform].some(
    (host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`)
  );
}

function getFirstProfileSegment(
  segments: string[],
  reservedPaths: Set<string>
): string | null {
  return (
    segments.find((part) => !reservedPaths.has(part.toLowerCase())) ?? null
  );
}

function normalizePlainSocialHandle(value: string): string | null {
  const handle = value
    .trim()
    .replace(/^@+/, '')
    .split(/[/?#&]/)[0]
    .replace(/^@+/, '')
    .trim();
  const normalized = handle.replace(/[^a-zA-Z0-9._-]/g, '');
  return normalized || null;
}

function getFacebookProfileId(url: URL, segments: string[]): string | null {
  if (segments[0]?.toLowerCase() !== 'profile.php') {
    return null;
  }

  return normalizePlainSocialHandle(url.searchParams.get('id') ?? '');
}

function normalizeSocialHandle(
  platform: SocialPlatform,
  value: string | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const canParseAsUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^(www\.)?(instagram|facebook|fb|x|twitter|tiktok)\.com\//i.test(trimmed);

  if (!canParseAsUrl) {
    return normalizePlainSocialHandle(trimmed);
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    );
    if (!isSocialHost(platform, url.hostname)) {
      return normalizePlainSocialHandle(trimmed);
    }

    const segments = url.pathname
      .split('/')
      .map((part) => safeDecodeUriComponent(part).trim())
      .filter(Boolean);
    let profileSegment: string | null = null;

    if (platform === 'instagram') {
      profileSegment = getFirstProfileSegment(segments, IG_RESERVED_PATHS);
    } else if (platform === 'facebook') {
      profileSegment =
        getFacebookProfileId(url, segments) ??
        getFirstProfileSegment(segments, FACEBOOK_RESERVED_PATHS);
    } else if (platform === 'twitter') {
      profileSegment = getFirstProfileSegment(segments, TWITTER_RESERVED_PATHS);
    } else {
      profileSegment =
        segments.find((part) => part.startsWith('@')) ??
        getFirstProfileSegment(segments, TIKTOK_RESERVED_PATHS);
    }

    return normalizePlainSocialHandle(profileSegment ?? '');
  } catch {
    return normalizePlainSocialHandle(trimmed);
  }
}

export function buildSocialItems(
  social: ReceiptMerchant['social_media']
): string[] {
  const socialEntries: Array<{ platform: SocialPlatform; handle: string }> = [];
  const instagramHandle = normalizeSocialHandle('instagram', social?.instagram);
  const facebookHandle = normalizeSocialHandle('facebook', social?.facebook);
  const twitterHandle = normalizeSocialHandle('twitter', social?.twitter);
  const tiktokHandle = normalizeSocialHandle('tiktok', social?.tiktok);

  if (instagramHandle) {
    socialEntries.push({ platform: 'instagram', handle: instagramHandle });
  }
  if (facebookHandle) {
    socialEntries.push({ platform: 'facebook', handle: facebookHandle });
  }
  if (twitterHandle) {
    socialEntries.push({ platform: 'twitter', handle: twitterHandle });
  }
  if (tiktokHandle) {
    socialEntries.push({ platform: 'tiktok', handle: tiktokHandle });
  }

  const grouped = new Map<string, SocialPlatform[]>();
  for (const entry of socialEntries) {
    const key = entry.handle.toLowerCase().replace(/^@/, '');
    const existing = grouped.get(key);
    if (existing) {
      existing.push(entry.platform);
    } else {
      grouped.set(key, [entry.platform]);
    }
  }

  return Array.from(grouped, ([handle, platforms]) => {
    const icons = platforms
      .map(
        (platform) =>
          `<span class="footer-icon">${SOCIAL_ICONS[platform]}</span>`
      )
      .join('');
    return `<span class="footer-item">${icons}<span>@${escapeHtml(handle)}</span></span>`;
  });
}
