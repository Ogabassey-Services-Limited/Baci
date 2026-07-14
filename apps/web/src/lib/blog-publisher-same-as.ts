import { filterBrandMatchedSocialProfiles } from '@/lib/brand-matched-social-profiles';
import { normalizeSocialUrl } from '@/lib/social';

const BLOG_PUBLISHER_SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'twitter',
  'youtube',
  'linkedin',
  'snapchat',
] as const;

type BlogPublisherSocialPlatform =
  (typeof BLOG_PUBLISHER_SOCIAL_PLATFORMS)[number];

function isBlogPublisherSocialPlatform(
  platform: string
): platform is BlogPublisherSocialPlatform {
  return BLOG_PUBLISHER_SOCIAL_PLATFORMS.includes(
    platform as BlogPublisherSocialPlatform
  );
}

export function buildBlogPublisherSameAs(
  socialMedia: Record<string, unknown> | null | undefined,
  businessName?: string
): string[] {
  if (!socialMedia) {
    return [];
  }

  const sameAs = new Set<string>();

  for (const [platform, value] of Object.entries(socialMedia)) {
    if (!isBlogPublisherSocialPlatform(platform) || typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeSocialUrl(value, platform);
    if (normalized) {
      sameAs.add(normalized);
    }
  }

  return businessName
    ? filterBrandMatchedSocialProfiles(businessName, sameAs)
    : [...sameAs];
}
