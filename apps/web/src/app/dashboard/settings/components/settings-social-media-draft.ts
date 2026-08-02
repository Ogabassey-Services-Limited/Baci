import type { CachedMerchant } from '@/lib/cached-data';

export function buildSocialMediaDraft(
  merchant: CachedMerchant | null | undefined
): Record<string, string> {
  return {
    twitter: merchant?.social_media?.twitter || '',
    facebook: merchant?.social_media?.facebook || '',
    instagram: merchant?.social_media?.instagram || '',
    tiktok: merchant?.social_media?.tiktok || '',
    youtube: merchant?.social_media?.youtube || '',
    pinterest: merchant?.social_media?.pinterest || '',
    linkedin: merchant?.social_media?.linkedin || '',
    snapchat: merchant?.social_media?.snapchat || '',
  };
}
